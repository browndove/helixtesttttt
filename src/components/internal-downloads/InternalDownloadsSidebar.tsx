'use client';

import Text from '@/components/text';
import clsx from 'clsx';
import { createContext, useContext, useState } from 'react';
import { MdSpaceDashboard } from 'react-icons/md';
import { FaDownload } from 'react-icons/fa6';
import { TiWarning } from 'react-icons/ti';

export type DownloadsDashboardTab = 'overview' | 'acquisition' | 'audience';

export const SIDEBAR_EXPANDED_WIDTH = 243;
export const SIDEBAR_DOCKED_WIDTH = 58;

const SidebarIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 17 17" fill="none" className={className}>
        <path d="M2.125 3.54167C2.125 2.7602 2.7602 2.125 3.54167 2.125H13.4583C14.2398 2.125 14.875 2.7602 14.875 3.54167V13.4583C14.875 14.2398 14.2398 14.875 13.4583 14.875H3.54167C2.7602 14.875 2.125 14.2398 2.125 13.4583V3.54167ZM6.375 3.54167V13.4583H13.4583V3.54167H6.375Z" fill="currentColor" />
    </svg>
);

type SidebarContextValue = {
    isDocked: boolean;
    setIsDocked: (docked: boolean) => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export const useDownloadsSidebar = () => {
    const context = useContext(SidebarContext);
    if (!context) {
        throw new Error('useDownloadsSidebar must be used within DownloadsSidebarProvider');
    }
    return context;
};

export function getDownloadsSidebarWidth(isDocked: boolean): number {
    return isDocked ? SIDEBAR_DOCKED_WIDTH : SIDEBAR_EXPANDED_WIDTH;
}

type MenuItem = {
    id: DownloadsDashboardTab;
    name: string;
    icon: React.ComponentType<{ className?: string; size?: number }>;
    iconSize: number;
};

const menuItems: MenuItem[] = [
    { id: 'overview', name: 'Overview', icon: MdSpaceDashboard, iconSize: 15 },
    { id: 'acquisition', name: 'Acquisition & Stability', icon: FaDownload, iconSize: 15 },
    { id: 'audience', name: 'Emergency & Critical Care', icon: TiWarning, iconSize: 17 },
];

const SidebarHeader = ({ isDocked, onDockToggle }: { isDocked: boolean; onDockToggle: () => void }) => {
    if (isDocked) {
        return (
            <div className="flex items-center justify-center px-[10px] shrink-0">
                <button
                    type="button"
                    onClick={onDockToggle}
                    className="flex items-center justify-center cursor-pointer hover:opacity-70 transition-opacity"
                    title="Expand sidebar"
                >
                    <SidebarIcon className="text-[#A3B2BE] w-[24px] h-[23px]" />
                </button>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 shrink-0" style={{ paddingLeft: 22, paddingRight: 15 }}>
            <Text variant="body-sm" color="text-tertiary" className="font-medium text-[12px] tracking-wide">
                DOWNLOADS ANALYTICS
            </Text>
            <button
                type="button"
                onClick={onDockToggle}
                className="flex shrink-0 items-center justify-center cursor-pointer hover:opacity-70 transition-opacity"
                title="Collapse sidebar"
            >
                <SidebarIcon className="text-[#A3B2BE]" />
            </button>
        </div>
    );
};

const MenuItems = ({
    isDocked,
    activeTab,
    onTabChange,
}: {
    isDocked: boolean;
    activeTab: DownloadsDashboardTab;
    onTabChange: (tab: DownloadsDashboardTab) => void;
}) => (
    <div className="flex flex-col gap-[5px] w-full">
        <div className="flex flex-col gap-[5px]">
            {menuItems.map((item) => {
                const isActive = activeTab === item.id;
                const Icon = item.icon;

                return (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => onTabChange(item.id)}
                        className={clsx(
                            'flex items-center h-[35px] rounded-[5px] transition-all duration-200 cursor-pointer w-auto text-left',
                            isDocked ? 'justify-center px-[12px]' : 'justify-start px-[12px]',
                            isActive ? 'bg-[rgba(41,128,211,0.1)]' : 'hover:bg-tertiary',
                        )}
                        style={isDocked ? undefined : { marginLeft: 10, marginRight: 10 }}
                        title={isDocked ? item.name : undefined}
                    >
                        <div className={clsx('flex items-center min-w-0', isDocked ? 'justify-center' : 'justify-start gap-[7px] ml-[10px]')}>
                            <Icon
                                size={item.iconSize}
                                className={clsx(
                                    'shrink-0',
                                    isActive ? 'text-accent-primary' : 'text-text-secondary',
                                )}
                            />
                            {!isDocked && (
                                <Text
                                    variant={isActive ? 'body-sm-semibold' : 'body-sm'}
                                    color={isActive ? 'accent-primary' : 'text-secondary'}
                                    className="truncate"
                                >
                                    {item.name}
                                </Text>
                            )}
                        </div>
                    </button>
                );
            })}
        </div>
    </div>
);

export function DownloadsSidebarProvider({ children }: { children: React.ReactNode }) {
    const [isDocked, setIsDocked] = useState(false);

    return (
        <SidebarContext.Provider value={{ isDocked, setIsDocked }}>
            {children}
        </SidebarContext.Provider>
    );
}

export default function InternalDownloadsSidebar({
    activeTab,
    onTabChange,
}: {
    activeTab: DownloadsDashboardTab;
    onTabChange: (tab: DownloadsDashboardTab) => void;
}) {
    const { isDocked, setIsDocked } = useDownloadsSidebar();

    return (
        <aside
            className={clsx(
                'internal-downloads-sidebar flex flex-col bg-primary border-r border-tertiary shadow-soft transition-all duration-300 shrink-0',
                isDocked ? 'w-[58px]' : 'w-[243px]',
            )}
            aria-label="Downloads analytics sections"
        >
            <div className="flex flex-col gap-[10px] w-full flex-1 min-h-0 overflow-y-auto pt-[15px] pb-[15px]">
                <SidebarHeader isDocked={isDocked} onDockToggle={() => setIsDocked(!isDocked)} />
                <MenuItems isDocked={isDocked} activeTab={activeTab} onTabChange={onTabChange} />
            </div>
        </aside>
    );
}
