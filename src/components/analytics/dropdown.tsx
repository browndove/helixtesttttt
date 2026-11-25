'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Text from './text';
import clsx from 'clsx';
import { IoChevronDown } from 'react-icons/io5';

export interface DropdownOption {
    value: string;
    label: string;
    icon?: React.ReactNode;
}

interface DropdownProps {
    options: DropdownOption[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    icon?: React.ReactNode;
    showChevron?: boolean;
    className?: string;
    triggerClassName?: string;
    menuClassName?: string;
    renderMenuInPortal?: boolean;
    portalZIndex?: number;
}

const Dropdown = ({
    options,
    value,
    onChange,
    placeholder = 'Select...',
    icon,
    showChevron = true,
    className,
    triggerClassName,
    menuClassName,
    renderMenuInPortal = false,
    portalZIndex = 9999,
}: DropdownProps) => {
    const selectedOption = options.find((opt) => opt.value === value);
    const [open, setOpen] = useState(false);
    const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; width: number }>({
        top: 0,
        left: 0,
        width: 0,
    });
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const menuRef = useRef<HTMLDivElement | null>(null);

    const updateMenuPosition = () => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        setMenuPosition({
            top: rect.bottom + 8,
            left: rect.right - Math.max(rect.width, 220),
            width: Math.max(rect.width, 220),
        });
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const targetNode = event.target as Node;
            const clickedInsideWrapper = !!wrapperRef.current?.contains(targetNode);
            const clickedInsideMenu = !!menuRef.current?.contains(targetNode);
            if (!clickedInsideWrapper && !clickedInsideMenu) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!open || !renderMenuInPortal) return;
        updateMenuPosition();
        const handleWindowChange = () => updateMenuPosition();
        window.addEventListener('resize', handleWindowChange);
        window.addEventListener('scroll', handleWindowChange, true);
        return () => {
            window.removeEventListener('resize', handleWindowChange);
            window.removeEventListener('scroll', handleWindowChange, true);
        };
    }, [open, renderMenuInPortal]);

    const menu = (
        <div
            ref={menuRef}
            className={clsx(
                'overflow-hidden rounded-[18px] border border-black/[0.08] bg-white z-50',
                renderMenuInPortal ? 'fixed' : 'absolute right-0 mt-2 min-w-[220px]',
                menuClassName
            )}
            style={
                renderMenuInPortal
                    ? { top: menuPosition.top, left: menuPosition.left, width: menuPosition.width, zIndex: portalZIndex, padding: '6px' }
                    : { padding: '6px' }
            }
        >
            <div className="flex flex-col gap-0.5">
                {options.map((option) => {
                    const isActive = value === option.value;
                    return (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                                onChange(option.value);
                                setOpen(false);
                            }}
                            className={clsx(
                                'relative flex w-full items-center gap-2.5 rounded-[8px] px-3 py-2.5 text-left transition-all duration-150',
                                isActive
                                    ? 'bg-accent-primary/8 hover:bg-accent-primary/10'
                                    : 'hover:bg-secondary/80 active:bg-secondary',
                            )}
                        >
                            {isActive ? (
                                <span
                                    aria-hidden
                                    className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r-full bg-accent-primary"
                                />
                            ) : null}
                            <div className="flex min-w-0 flex-1 items-center gap-2.5 pl-0.5">
                                {option.icon ? (
                                    <span className={isActive ? 'text-accent-primary' : 'text-text-secondary'}>
                                        {option.icon}
                                    </span>
                                ) : null}
                                <Text
                                    variant={isActive ? 'body-sm-semibold' : 'body-sm'}
                                    className={clsx(
                                        'truncate',
                                        isActive ? 'text-accent-primary' : 'text-text-primary',
                                    )}
                                >
                                    {option.label}
                                </Text>
                            </div>
                            {isActive ? (
                                <span
                                    aria-hidden
                                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-primary"
                                />
                            ) : null}
                        </button>
                    );
                })}
            </div>
        </div>
    );

    return (
        <div className={clsx('relative', className)} ref={wrapperRef}>
            <button
                ref={triggerRef}
                type="button"
                onClick={() => {
                    setOpen((prev) => {
                        const next = !prev;
                        if (next && renderMenuInPortal) updateMenuPosition();
                        return next;
                    });
                }}
                className={clsx(
                    'relative flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-full border px-4 py-2.5',
                    'border-black/[0.08] bg-white',
                    'transition-[border-color,transform,background-color] duration-150',
                    'hover:border-black/[0.14] active:scale-[0.95]',
                    open && 'border-accent-primary/40',
                    triggerClassName,
                )}
            >
                {selectedOption ? (
                    <span
                        aria-hidden
                        className="absolute bottom-2.5 left-0 top-2.5 w-[3px] rounded-r-full bg-accent-primary"
                    />
                ) : null}
                {icon ? <span className="text-text-secondary">{icon}</span> : null}
                <div className="min-w-0 flex-1 pl-1 text-left">
                    <Text
                        variant="body-sm-semibold"
                        className="truncate text-text-primary"
                    >
                        {selectedOption?.label || placeholder}
                    </Text>
                </div>
                {showChevron ? (
                    <IoChevronDown
                        className={clsx(
                            'h-3.5 w-3.5 shrink-0 text-text-tertiary transition-transform duration-200',
                            open && 'rotate-180 text-accent-primary',
                        )}
                    />
                ) : null}
            </button>

            {open && (
                renderMenuInPortal ? createPortal(menu, document.body) : menu
            )}
        </div>
    );
};

export default Dropdown;
