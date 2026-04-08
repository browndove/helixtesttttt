'use client';

import { useState, useEffect } from 'react';
import Text from '@/components/text';
import FullscreenOverlay from '@/components/fullscreen-overlay';
import clsx from 'clsx';
import { FiX } from 'react-icons/fi';

interface DepartmentMetricItem {
    department_name: string;
    role_fill_rate_percent: number;
    filled_roles: number;
    total_roles: number;
    critical_role_fill_rate_percent: number;
    critical_filled_roles: number;
    critical_total_roles: number;
}

interface RoleCoverageModalProps {
    isOpen: boolean;
    onClose: () => void;
    departments: DepartmentMetricItem[];
}

export default function RoleCoverageModal({ isOpen, onClose, departments }: RoleCoverageModalProps) {
    const [sortConfig, setSortConfig] = useState<{ column: number; ascending: boolean } | null>(null);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSort = (columnIndex: number) => {
        if (sortConfig?.column === columnIndex) {
            setSortConfig({
                column: columnIndex,
                ascending: !sortConfig.ascending,
            });
        } else {
            setSortConfig({ column: columnIndex, ascending: true });
        }
    };

    const headers = [
        'Department',
        'Filled Roles',
        'Total Roles',
        'Fill Rate',
        'Critical Filled',
        'Critical Total',
        'Critical Fill Rate',
    ];

    const rows = departments.map((dept) => [
        dept.department_name,
        dept.filled_roles,
        dept.total_roles,
        dept.role_fill_rate_percent.toFixed(1),
        dept.critical_filled_roles,
        dept.critical_total_roles,
        dept.critical_role_fill_rate_percent.toFixed(1),
    ]);

    const sortedRows = sortConfig
        ? [...rows].sort((a, b) => {
            const aVal = a[sortConfig.column];
            const bVal = b[sortConfig.column];

            const aNum = typeof aVal === 'number' ? aVal : parseFloat(String(aVal));
            const bNum = typeof bVal === 'number' ? bVal : parseFloat(String(bVal));

            if (!isNaN(aNum) && !isNaN(bNum)) {
                return sortConfig.ascending ? aNum - bNum : bNum - aNum;
            }

            const aStr = String(aVal).toLowerCase();
            const bStr = String(bVal).toLowerCase();
            return sortConfig.ascending
                ? aStr.localeCompare(bStr)
                : bStr.localeCompare(aStr);
        })
        : rows;

    return (
        <FullscreenOverlay onClose={onClose}>
            <div
                className="bg-primary rounded-[15px] shadow-xl w-[95vw] h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-secondary/30" style={{ padding: '32px 32px 24px 32px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <Text variant="heading-md" color="text-primary" className="font-bold">
                            Role Coverage Details
                        </Text>
                        <Text variant="body-sm" color="text-secondary">
                            Critical & standard role fill rates by department
                        </Text>
                    </div>
                    <button
                        onClick={onClose}
                        className="hover:bg-secondary/20 rounded-md transition-colors"
                        style={{ padding: '8px', flexShrink: 0 }}
                        title="Close"
                    >
                        <FiX className="w-5 h-5 text-text-secondary" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="sticky top-0 bg-secondary/20">
                                <tr>
                                    {headers.map((header, idx) => (
                                        <th
                                            key={idx}
                                            onClick={() => handleSort(idx)}
                                            className={clsx(
                                                "text-left text-sm font-semibold text-text-primary",
                                                "cursor-pointer hover:bg-secondary/30 transition-colors",
                                                "whitespace-nowrap select-none"
                                            )}
                                            style={{ padding: '16px 24px' }}
                                        >
                                            <div className="flex items-center gap-2">
                                                {header}
                                                {sortConfig?.column === idx && (
                                                    <span className="text-accent-primary text-xs font-bold">
                                                        {sortConfig.ascending ? '↑' : '↓'}
                                                    </span>
                                                )}
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {sortedRows.map((row, rowIdx) => (
                                    <tr
                                        key={rowIdx}
                                        className={clsx(
                                            "border-b border-secondary/20",
                                            rowIdx % 2 === 0 ? "bg-primary" : "bg-secondary/5",
                                            "hover:bg-secondary/10 transition-colors"
                                        )}
                                    >
                                        {row.map((cell, cellIdx) => (
                                            <td
                                                key={cellIdx}
                                                className="text-sm text-text-primary whitespace-nowrap"
                                                style={{ padding: '14px 24px' }}
                                            >
                                                {typeof cell === 'string' && cell.includes('%')
                                                    ? `${cell}%`
                                                    : cell}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {departments.length === 0 && (
                        <div className="flex items-center justify-center py-12">
                            <Text variant="body-sm" color="text-secondary">
                                No department data available
                            </Text>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-secondary/30 flex justify-end gap-2" style={{ padding: '20px 32px' }}>
                    <button
                        onClick={onClose}
                        className={clsx(
                            "rounded-md font-semibold text-sm transition-all",
                            "bg-secondary/20 hover:bg-secondary/30 text-text-primary"
                        )}
                        style={{ padding: '8px 16px' }}
                    >
                        Close
                    </button>
                </div>
            </div>
        </FullscreenOverlay>
    );
}
