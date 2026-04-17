'use client';

import Image from "next/image";
import Text from "../text";
import { IoSearch, IoLogOut } from "react-icons/io5";
import { MdSpaceDashboard } from "react-icons/md";
import { PiHospitalFill } from "react-icons/pi";
import { FaHeartPulse, FaUser } from "react-icons/fa6";
import Link from "next/link";
import { useState, createContext, useContext, useEffect } from "react";
import clsx from "clsx";
import { TiWarning } from "react-icons/ti";
import { BsCreditCardFill } from "react-icons/bs";
import { BiSolidShieldPlus } from "react-icons/bi";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";

// Sidebar toggle icon
const SidebarIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 17 17" fill="none" className={className}>
        <path d="M2.125 3.54167C2.125 2.7602 2.7602 2.125 3.54167 2.125H13.4583C14.2398 2.125 14.875 2.7602 14.875 3.54167V13.4583C14.875 14.2398 14.2398 14.875 13.4583 14.875H3.54167C2.7602 14.875 2.125 14.2398 2.125 13.4583V3.54167ZM6.375 3.54167V13.4583H13.4583V3.54167H6.375Z" fill="currentColor" />
    </svg>
);

const SidebarContext = createContext<{ isDocked: boolean; setIsDocked: (docked: boolean) => void } | null>(null);

export const useSidebar = () => {
    const context = useContext(SidebarContext);
    if (!context) {
        throw new Error('useSidebar must be used within SidebarProvider');
    }
    return context;
};

type MenuItem = {
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string; size?: number }>;
}

const menuItems: MenuItem[] = [
    {
        name: "Executive Overview",
        href: "/dashboard/executive-overview",
        icon: MdSpaceDashboard,
    },
    {
        name: "Clinical Operations",
        href: "/dashboard/clinical-operations",
        icon: PiHospitalFill,
    },
    {
        name: "Clinical Outcomes",
        href: "/dashboard/clinical-outcomes",
        icon: FaHeartPulse,
    },
    {
        name: "Patient Insight",
        href: "/dashboard/patient-insight",
        icon: FaUser,
    },
    {
        name: "Emergency & Critical Care",
        href: "/dashboard/emergency-critical-care",
        icon: TiWarning,
    },
    {
        name: "Billing & Finance",
        href: "/dashboard/billing-finance",
        icon: BsCreditCardFill,
    },
    {
        name: "Safety & Reports",
        href: "/dashboard/safety-reports",
        icon: BiSolidShieldPlus,
    },
];

const RightSlot = () => (
    <div className="flex items-center justify-center size-[18px] rounded-[4.605px] bg-tertiary">
        <Text variant="body-xs" color="text-primary" className="font-semibold text-[7.895px]">/</Text>
    </div>
);

const LogoSection = ({ isDocked, onDockToggle }: { isDocked: boolean; onDockToggle: () => void }) => {
    const { resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    // Avoid hydration mismatch
    useEffect(() => {
        setMounted(true);
    }, []);

    // Use dark mode logo for dark and blue themes, light mode logo otherwise
    const logoSrc = mounted && (resolvedTheme === "dark" || resolvedTheme === "blue")
        ? "/assets/images/ugmc-logo-full-dark-mode.png"
        : "/assets/images/ugmc-logo-full-light-mode.png";

    return (
        <div className={clsx(
            "flex flex-col w-full bg-primary-light border-b border-secondary",
            isDocked ? "gap-[15px] px-[10px] py-[20px]" : "gap-[15px] px-[15px] py-[20px]"
        )}>
            {/* Logo and dock toggle */}
            {!isDocked ? (
                <div className="flex items-center gap-[10px] px-[2px]">
                    <Image
                        src={logoSrc}
                        alt="UGMC Logo"
                        width={173}
                        height={29}
                        className="h-[29px] w-auto"
                    />
                    <button
                        onClick={onDockToggle}
                        className="flex-1 flex items-center justify-end cursor-pointer hover:opacity-70 transition-opacity"
                        title="Collapse sidebar"
                    >
                        <SidebarIcon className="text-[#A3B2BE]" />
                    </button>
                </div>
            ) : (
                <button
                    onClick={onDockToggle}
                    className="flex items-center justify-center cursor-pointer hover:opacity-70 transition-opacity px-[2px]"
                    title="Expand sidebar"
                >
                    <SidebarIcon className="text-[#A3B2BE] w-[24px] h-[23px]" />
                </button>
            )}

            {/* Search input */}
            {!isDocked ? (
                <div className="bg-primary border border-tertiary rounded-[10px] shadow-input h-[35px] flex items-center justify-between px-[11px] py-[7px]">
                    <div className="flex items-center gap-[4px]">
                        <IoSearch size={15} className="text-[#A3B2BE]" />
                        <Text variant="body-sm" color="text-tertiary">
                            Search anything...
                        </Text>
                    </div>
                    <RightSlot />
                </div>
            ) : (
                <div className="bg-primary border border-tertiary rounded-[10px] shadow-input h-[35px] flex items-center justify-center px-[11px] py-[7px]">
                    <IoSearch size={15} className="text-[#A3B2BE]" />
                </div>
            )}
        </div>
    );
};

const MenuItems = ({ isDocked }: { isDocked: boolean }) => {
    const pathname = usePathname();

    return (
        <div className={clsx("flex flex-col gap-[10px] w-full", isDocked ? "px-[10px]" : "px-[10px]")}>
            {/* Section label */}
            {!isDocked && (
                <div className="flex items-center pl-[12px] pr-[7px]">
                    <Text variant="body-sm" color="text-tertiary" className="font-medium text-[12px]">
                        EXECUTIVE DASHBOARD
                    </Text>
                </div>
            )}

            {/* Menu items */}
            <div className="flex flex-col gap-[5px]">
                {menuItems.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                    const Icon = item.icon;

                    return (
                        <Link
                            href={item.href}
                            key={item.name}
                            className={clsx(
                                "flex items-center h-[35px] rounded-[5px] transition-all duration-200",
                                isDocked ? "justify-center px-[12px]" : "gap-[5px] px-[12px]",
                                isActive ? "bg-[rgba(41,128,211,0.1)]" : "hover:bg-tertiary"
                            )}
                            title={isDocked ? item.name : undefined}
                        >
                            <div className={clsx("flex items-center", isDocked ? "" : "gap-[5px]")}>
                                <Icon
                                    size={item.icon === TiWarning || item.icon === FaUser ? 17 : item.icon === BsCreditCardFill ? 18 : item.icon === BiSolidShieldPlus ? 20 : 15}
                                    className={clsx(
                                        "shrink-0",
                                        isActive ? "text-accent-primary" : "text-text-secondary"
                                    )}
                                />
                                {!isDocked && (
                                    <Text
                                        variant={isActive ? "body-sm-semibold" : "body-sm"}
                                        color={isActive ? "accent-primary" : "text-secondary"}
                                    >
                                        {item.name}
                                    </Text>
                                )}
                            </div>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
};

export const SidebarProvider = ({ children }: { children: React.ReactNode }) => {
    const [isDocked, setIsDocked] = useState(false);

    return (
        <SidebarContext.Provider value={{ isDocked, setIsDocked }}>
            {children}
        </SidebarContext.Provider>
    );
};

const LogoutButton = ({ isDocked }: { isDocked: boolean }) => {
    const router = useRouter();

    const handleLogout = () => {
        localStorage.removeItem("ugmc:isLoggedIn");
        localStorage.removeItem("ugmc:isVerified");
        localStorage.removeItem("ugmc:email");
        localStorage.removeItem("ugmc:phone");
        router.push("/auth");
    };

    return (
        <div className={clsx("w-full border-t border-tertiary", isDocked ? "px-[10px] py-[15px]" : "px-[10px] py-[15px]")}>
            <button
                onClick={handleLogout}
                className={clsx(
                    "flex items-center w-full h-[40px] rounded-[8px] transition-all duration-200 cursor-pointer hover:bg-accent-red/20 bg-accent-red/10 group",
                    isDocked ? "justify-center px-[12px]" : "gap-1 px-[12px]"
                )}
                title={isDocked ? "Logout" : undefined}
            >
                <IoLogOut
                    size={18}
                    className="text-accent-red min-w-[18px] transition-colors"
                />
                {!isDocked && (
                    <Text
                        variant="body-sm-semibold"
                        color="accent-red"
                    >
                        Logout
                    </Text>
                )}
            </button>
        </div>
    );
};

const GenerateReportButton = ({ isDocked }: { isDocked: boolean }) => {
    return (
        <div className="flex px-2 w-full">
            <button
                className={clsx(
                    "flex items-center w-full h-[40px] rounded-[8px] transition-all duration-200 cursor-pointer hover:bg-accent-primary/20 bg-accent-primary/10 group",
                    isDocked ? "justify-center px-[12px]" : "gap-1 px-[12px]"
                )}
                title={isDocked ? "Logout" : undefined}
            >
                <IoLogOut
                    size={18}
                    className="text-accent-primary min-w-[18px] transition-colors"
                />
                {!isDocked && (
                    <Text
                        variant="body-sm-semibold"
                        color="accent-primary"
                    >
                        Generate Report
                    </Text>
                )}
            </button>
        </div>
    )
}

const SidebarContent = () => {
    const { isDocked, setIsDocked } = useSidebar();

    return (
        <div className={clsx(
            "flex flex-col justify-between h-full bg-primary border-r border-tertiary fixed top-0 left-0 shadow-soft transition-all duration-300",
            isDocked ? "w-[58px]" : "w-[243px]"
        )}>
            <div className="flex flex-col gap-[20px] w-full">
                <LogoSection isDocked={isDocked} onDockToggle={() => setIsDocked(!isDocked)} />
                <MenuItems isDocked={isDocked} />
            </div>
            <div className="flex flex-col gap-4">
                <GenerateReportButton isDocked={isDocked} />
                <LogoutButton isDocked={isDocked} />
            </div>
        </div>
    );
};

const Sidebar = () => {
    return <SidebarContent />;
};

export default Sidebar;
