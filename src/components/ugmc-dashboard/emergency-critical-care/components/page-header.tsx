"use client";

import * as React from "react";
import Text from "@/components/text";
import { IoSearch } from "react-icons/io5";
import { LuCommand } from "react-icons/lu";
import Image from "next/image";

const PageHeader: React.FC = () => {
    return (
        <div className="flex items-center justify-between w-full">
            <Text variant="heading-md" color="text-primary">
                Emergency & Critical Care
            </Text>
            <div className="flex items-center gap-4">
                {/* Search Bar */}
                <div className="flex items-center gap-2 bg-primary rounded-full px-4 py-2 w-[280px] border border-bg-tertiary">
                    <IoSearch size={16} className="text-text-tertiary" />
                    <input
                        type="text"
                        placeholder="Search anything..."
                        className="flex-1 bg-transparent outline-none text-sm text-text-primary placeholder:text-text-tertiary"
                    />
                    <div className="flex items-center justify-center bg-tertiary px-2 py-1 rounded-full gap-1">
                        <LuCommand size={12} className="text-text-tertiary" />
                        <span className="text-[11px] text-text-tertiary font-medium">K</span>
                    </div>
                </div>

                {/* User Avatar */}
                <div className="flex items-center gap-2 cursor-pointer bg-primary rounded-full pl-1 pr-3 py-1">
                    <Image
                        src="/assets/images/avatar.png"
                        alt="User avatar"
                        width={32}
                        height={32}
                        className="rounded-full object-cover"
                    />
                    <Text variant="body-sm-semibold" color="text-primary">
                        Dr. Abdul-Samed Tanko
                    </Text>
                </div>
            </div>
        </div>
    );
};

export default PageHeader;
