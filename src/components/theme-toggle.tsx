"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import Dropdown, { DropdownOption } from "./dropdown";
import { IoSunny, IoMoon, IoDesktop, IoWater } from "react-icons/io5";

const themeOptions: DropdownOption[] = [
	{
		value: "system",
		label: "System",
		icon: <IoDesktop className="w-4 h-4" />,
	},
	{
		value: "light",
		label: "Light",
		icon: <IoSunny className="w-4 h-4" />,
	},
	{
		value: "dark",
		label: "Dark",
		icon: <IoMoon className="w-4 h-4" />,
	},
	{
		value: "blue",
		label: "Blue",
		icon: <IoWater className="w-4 h-4" />,
	},
];

export function ThemeToggle() {
	const { theme, setTheme, resolvedTheme } = useTheme();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) {
		return (
			<div className="flex items-center gap-2 px-3 py-2 rounded-full bg-tertiary h-[40px] w-[120px] animate-pulse" />
		);
	}

	const getIcon = () => {
		if (theme === "system") {
			return resolvedTheme === "dark" ? <IoMoon className="w-4 h-4" /> : <IoSunny className="w-4 h-4" />;
		}
		const currentOption = themeOptions.find((t) => t.value === theme);
		return currentOption?.icon || <IoSunny className="w-4 h-4" />;
	};

	return (
		<Dropdown
			options={themeOptions}
			value={theme || "system"}
			onChange={setTheme}
			icon={getIcon()}
		/>
	);
}
