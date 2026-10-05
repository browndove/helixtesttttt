'use client';

import { ChevronLeft, ChevronRight, Search, SlidersHorizontal } from 'lucide-react';
import CustomSelect from '@/components/CustomSelect';
import { input } from './bed-layout-ui';

export type StatusFilter = 'all' | 'available' | 'occupied' | 'blocked';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All status' },
    { value: 'available', label: 'Has available' },
    { value: 'occupied', label: 'Has occupied' },
    { value: 'blocked', label: 'Has out of service' },
];

/** Search, page size, pager and status filter shared by the floor and room tables. */
export default function BedLayoutToolbar({
    search,
    onSearch,
    placeholder,
    pageSize,
    onPageSize,
    page,
    pageCount,
    onPage,
    status,
    onStatus,
    statusOptions = STATUS_OPTIONS,
    extraFilters,
}: {
    search: string;
    onSearch: (value: string) => void;
    placeholder: string;
    pageSize: number;
    onPageSize: (value: number) => void;
    page: number;
    pageCount: number;
    onPage: (value: number) => void;
    status: StatusFilter;
    onStatus: (value: StatusFilter) => void;
    statusOptions?: { value: StatusFilter; label: string }[];
    /** Revealed by "More filters"; omitted when there is nothing extra to offer. */
    extraFilters?: React.ReactNode;
}) {
    const pagerButton = (disabled: boolean, onClick: () => void, children: React.ReactNode) => (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            style={{
                width: 28, height: 30, border: '1px solid #E1E7EF', background: '#FFFFFF',
                color: disabled ? '#C3CBD6' : '#475467', cursor: disabled ? 'default' : 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
        >
            {children}
        </button>
    );

    return (
        <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 320 }}>
                    <Search size={13} strokeWidth={1.8} color="#9AA7B8" style={{ position: 'absolute', left: 10, top: 11, pointerEvents: 'none' }} />
                    <input
                        value={search}
                        onChange={e => { onSearch(e.target.value); onPage(1); }}
                        placeholder={placeholder}
                        style={{ ...input, height: 34, paddingLeft: 30, fontSize: 12.5 }}
                    />
                </div>

                <div style={{ width: 84, flexShrink: 0 }}>
                    <CustomSelect
                        value={String(pageSize)}
                        onChange={value => { onPageSize(Number(value)); onPage(1); }}
                        options={[10, 20, 50].map(size => ({ label: String(size), value: String(size) }))}
                        style={{ height: 30, fontSize: 12, borderRadius: 8, border: '1px solid #E1E7EF' }}
                    />
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                    {pagerButton(page <= 1, () => onPage(page - 1), <ChevronLeft size={14} strokeWidth={2} />)}
                    <span style={{
                        height: 30, padding: '0 12px', borderTop: '1px solid #E1E7EF', borderBottom: '1px solid #E1E7EF',
                        display: 'inline-flex', alignItems: 'center', fontSize: 12, color: '#475467', whiteSpace: 'nowrap',
                        background: '#FFFFFF',
                    }}>
                        Page {page} of {pageCount}
                    </span>
                    {pagerButton(page >= pageCount, () => onPage(page + 1), <ChevronRight size={14} strokeWidth={2} />)}
                </div>

                <div style={{ width: 168, flexShrink: 0 }}>
                    <CustomSelect
                        value={status}
                        onChange={value => { onStatus(value as StatusFilter); onPage(1); }}
                        options={statusOptions}
                        style={{ height: 34, fontSize: 12.5, borderRadius: 8, border: '1px solid #E1E7EF' }}
                    />
                </div>

                {extraFilters && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <SlidersHorizontal size={13} strokeWidth={1.8} color="#9AA7B8" />
                        {extraFilters}
                    </div>
                )}
            </div>
        </div>
    );
}
