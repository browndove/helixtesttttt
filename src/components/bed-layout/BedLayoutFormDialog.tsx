'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
    Bed as BedIcon,
    Building2,
    DoorOpen,
    Hospital,
    Layers,
    Plus,
    Sparkles,
    X,
} from 'lucide-react';
import CustomSelect from '@/components/CustomSelect';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { API_ENDPOINTS } from '@/lib/config';
import { appendFacilityIdForProxy } from '@/lib/facility-client';
import type { BedStatus } from '@/lib/beds';
import {
    NESTED_LIMITS,
    WARD_TYPES,
    hierarchyApiMessage,
    optionalForApi,
    optionalFromApi,
    parseFloors,
    parseRoom,
    parseRooms,
    parseWards,
    wardTypeLabel,
    type Block,
    type Floor,
    type HierarchyBed,
    type Room,
    type Ward,
} from '@/lib/bed-hierarchy';
import {
    BED_STATUS_META,
} from './bed-layout-ui';
import type { PreviewOp } from './preview-store';

export type LayoutLevel = 'block' | 'floor' | 'ward' | 'room' | 'bed';

export type LayoutContext = {
    blockId?: string;
    floorId?: string;
    wardId?: string;
    roomId?: string;
    /** Optional labels for the location strip / subtitle when IDs are known. */
    blockName?: string;
    floorName?: string;
    wardName?: string;
    roomLabel?: string;
};

export type FormDialogRequest =
    | { kind: 'create'; level: LayoutLevel; context: LayoutContext }
    | { kind: 'edit'; level: 'block'; entity: Block }
    | { kind: 'edit'; level: 'floor'; entity: Floor }
    | { kind: 'edit'; level: 'ward'; entity: Ward }
    | { kind: 'edit'; level: 'room'; entity: Room }
    | { kind: 'edit'; level: 'bed'; entity: HierarchyBed };

type WardDraft = {
    name: string;
    nameChoice: string;
    code: string;
    type: string;
    gender: string;
};
type RoomDraft = { number: string; name: string };
type BedDraft = { bed_number: string; bed_code: string; status: BedStatus };

const NEW = '__new';
const OTHER = '__other';

const fieldSelectStyle: CSSProperties = {
    width: '100%',
    minWidth: 0,
    height: 40,
    borderRadius: 8,
    border: '1px solid #E1E7EF',
    fontSize: 13,
    boxSizing: 'border-box',
    boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)',
};

function readCreatedId(raw: unknown): string {
    if (!raw || typeof raw !== 'object') return '';
    const rec = raw as Record<string, unknown>;
    if (typeof rec.id === 'string' && rec.id) return rec.id;
    for (const key of ['room', 'data', 'unit', 'ward', 'department']) {
        const nested = rec[key];
        if (nested && typeof nested === 'object' && typeof (nested as Record<string, unknown>).id === 'string') {
            return (nested as Record<string, unknown>).id as string;
        }
    }
    const rooms = rec.rooms;
    if (Array.isArray(rooms) && rooms[0] && typeof rooms[0] === 'object' && typeof (rooms[0] as Record<string, unknown>).id === 'string') {
        return (rooms[0] as Record<string, unknown>).id as string;
    }
    return '';
}

function withTypedOption(options: { label: string; value: string }[], current: string) {
    const typed = current.trim();
    if (!typed || options.some(option => option.value === typed || option.label.trim().toLowerCase() === typed.toLowerCase())) {
        return options;
    }
    return [{ label: typed, value: typed }, ...options];
}

function matchedOption(value: string, options: { label: string; value: string }[]) {
    const typed = value.trim().toLowerCase();
    return options.find(option => option.value === value || option.value.toLowerCase() === typed || option.label.trim().toLowerCase() === typed);
}

/** The facility keeps unit names unique, so a second floor stores the same label with a hidden mark. */
function visibleUnitName(name: string): string {
    return name.replace(/[\u200B\u200C\u200D\u2060\uFEFF]/g, '').trim();
}

function sameUnitName(a: string, b: string): boolean {
    return visibleUnitName(a).toLowerCase() === visibleUnitName(b).toLowerCase();
}

function unitNameForFloor(name: string, floorId: string): string {
    const visible = visibleUnitName(name);
    let mark = '\u2060';
    for (let i = 0; i < floorId.length; i += 1) {
        mark += (floorId.charCodeAt(i) + i) % 2 === 0 ? '\u200B' : '\u200C';
    }
    return `${visible}${mark}`;
}

const LEVEL_TITLES: Record<LayoutLevel, { create: string; edit: string }> = {
    block: { create: 'Add building', edit: 'Edit building' },
    floor: { create: 'Add floor', edit: 'Edit floor' },
    ward: { create: 'Add unit', edit: 'Edit unit' },
    room: { create: 'Add room', edit: 'Edit room' },
    bed: { create: 'Add bed', edit: 'Edit bed' },
};

const CREATE_CTA: Record<LayoutLevel, string> = {
    block: 'Add building',
    floor: 'Add floor',
    ward: 'Add unit',
    room: 'Add room',
    bed: 'Add bed',
};

const LEVEL_ORDER: LayoutLevel[] = ['block', 'floor', 'ward', 'room', 'bed'];

const LEVEL_NOUNS: Record<LayoutLevel, string> = {
    block: 'Building',
    floor: 'Floor',
    ward: 'Unit',
    room: 'Room',
    bed: 'Bed',
};

const CREATE_INTROS: Record<LayoutLevel, string> = {
    block: 'Add a building to this facility. You can add its floors now or later.',
    floor: 'Add a floor to a building, along with any units on it.',
    ward: 'A unit is a ward or department, such as Maternity or ICU. Add its rooms now or later.',
    room: 'Rooms hold beds. Add the room, then any beds inside it.',
    bed: 'Add one or more beds to a room. You can change a bed’s status at any time.',
};

const EDIT_INTROS: Record<LayoutLevel, string> = {
    block: 'Rename this building.',
    floor: 'Rename this floor.',
    ward: 'Update the unit’s name, code, type or gender.',
    room: 'Update the room number or name.',
    bed: 'Update the bed number, code or status.',
};

function levelIcon(level: LayoutLevel, className: string) {
    const props = { className, strokeWidth: 1.9 };
    if (level === 'block') return <Building2 {...props} />;
    if (level === 'floor') return <Layers {...props} />;
    if (level === 'ward') return <Hospital {...props} />;
    if (level === 'room') return <DoorOpen {...props} />;
    return <BedIcon {...props} />;
}

const BED_STATUS_OPTIONS: { value: BedStatus; label: string; dot: string }[] = [
    { value: 'available', label: 'Available', dot: 'bg-emerald-500' },
    { value: 'occupied', label: 'Occupied', dot: 'bg-sky-500' },
    { value: 'blocked', label: 'Unavailable', dot: 'bg-[#94A3B8]' },
];

const BED_GRID = 'sm:grid-cols-[88px_minmax(0,1fr)_272px_32px]';
const ROOM_GRID = 'sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_32px]';
const FLOOR_GRID = 'sm:grid-cols-[minmax(0,1fr)_32px]';

function OptionalTag() {
    return <span className="text-[12px] font-normal text-[#94A3B8]">Optional</span>;
}

function FieldLabel({ children, optional }: { children: ReactNode; optional?: boolean }) {
    return (
        <Label className="mb-1.5 flex items-baseline gap-1.5 text-[12.5px] font-medium text-[#475569]">
            {children}
            {optional ? <OptionalTag /> : null}
        </Label>
    );
}

/** Uses divs, not headings: the global h1–h4 rules in globals.css are unlayered and override Tailwind sizes. */
function Section({
    step,
    title,
    description,
    optional,
    children,
}: {
    step?: number;
    title: string;
    description?: string;
    optional?: boolean;
    children: ReactNode;
}) {
    return (
        <section className="grid gap-4 border-t border-[#EEF2F7] pt-7 first:border-t-0 first:pt-0">
            <div className="flex items-start gap-3">
                {step ? (
                    <span className="mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1E3A5F] text-[12px] font-semibold text-white">
                        {step}
                    </span>
                ) : null}
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <div className="text-[15px] font-semibold leading-6 tracking-[-0.01em] text-[#0F172A]">{title}</div>
                        {optional ? (
                            <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[11px] font-medium text-[#64748B]">Optional</span>
                        ) : null}
                    </div>
                    {description ? <p className="mt-0.5 text-[12.5px] leading-5 text-[#64748B]">{description}</p> : null}
                </div>
            </div>
            <div className={cn('min-w-0', step && 'sm:pl-9')}>{children}</div>
        </section>
    );
}

type TrailNode = { level: LayoutLevel; label: string; value: string; detail?: string; current?: boolean };

function unitDetail(type: string, gender: string): string {
    const parts = [type.trim() ? wardTypeLabel(type.trim()) : ''];
    const g = gender.trim();
    if (g === 'female') parts.push('Female only');
    else if (g === 'male') parts.push('Male only');
    else if (g === 'mixed') parts.push('Mixed');
    return parts.filter(Boolean).join(' · ');
}

function PlacementTrail({ nodes }: { nodes: TrailNode[] }) {
    return (
        <ol className="grid min-w-0 grid-cols-[minmax(0,1fr)]">
            {nodes.map((node, index) => {
                const last = index === nodes.length - 1;
                return (
                    <li key={node.level} className="relative flex min-w-0 gap-3 pb-5 last:pb-0">
                        {!last ? <span aria-hidden className="absolute bottom-0 left-[13.5px] top-8 w-px bg-[#E2E8F0]" /> : null}
                        <span
                            className={cn(
                                'relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border',
                                node.current
                                    ? 'border-[#1E3A5F] bg-[#1E3A5F] text-white shadow-[0_2px_6px_rgba(30,58,95,0.25)]'
                                    : node.value
                                        ? 'border-[#D5DEE8] bg-white text-[#475569]'
                                        : 'border-dashed border-[#CBD5E1] text-[#94A3B8]',
                            )}
                        >
                            {levelIcon(node.level, 'h-3.5 w-3.5')}
                        </span>
                        <div className="min-w-0 flex-1">
                            <div className="text-[11.5px] leading-4 text-[#94A3B8]">{node.label}</div>
                            <div
                                className={cn(
                                    'line-clamp-2 wrap-break-word text-[13px] leading-5',
                                    node.value ? 'font-medium text-[#0F172A]' : 'text-[#94A3B8]',
                                )}
                                title={node.value || undefined}
                            >
                                {node.value || (node.current ? 'Not entered yet' : 'Not chosen yet')}
                            </div>
                            {node.detail ? (
                                <div className="mt-0.5 truncate text-[12px] leading-4 text-[#64748B]">{node.detail}</div>
                            ) : null}
                        </div>
                    </li>
                );
            })}
        </ol>
    );
}

function ListShell({
    header,
    grid,
    empty,
    footer,
    children,
}: {
    header: ReactNode[];
    grid: string;
    empty?: string;
    footer?: ReactNode;
    children?: ReactNode;
}) {
    return (
        <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            {empty ? (
                <div className="px-4 py-5 text-center text-[13px] text-[#94A3B8]">{empty}</div>
            ) : children ? (
                <>
                    {header.length ? (
                        <div className={cn('hidden items-center gap-2 border-b border-[#EEF2F7] bg-[#F8FAFC] px-3 py-2 text-[12px] font-medium text-[#64748B] sm:grid', grid)}>
                            {header.map((cell, index) => <div key={index} className="flex items-baseline gap-1.5">{cell}</div>)}
                        </div>
                    ) : null}
                    <div className="divide-y divide-[#EEF2F7]">{children}</div>
                </>
            ) : null}
            {footer}
        </div>
    );
}

function ListAddRow({
    label,
    count,
    limit,
    onClick,
}: {
    label: string;
    count: number;
    limit: number;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={count >= limit}
            className="flex h-11 w-full items-center gap-2 border-t border-[#EEF2F7] px-4 first:border-t-0 text-[13px] font-medium text-[#1E3A5F] transition-colors hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:text-[#94A3B8] disabled:hover:bg-transparent"
        >
            <Plus className="h-4 w-4" strokeWidth={2} />
            {label}
            <span className="ml-auto text-[12px] font-normal text-[#94A3B8]">{count} of {limit}</span>
        </button>
    );
}

function RemoveButton({ label, onClick }: { label: string; onClick: (() => void) | null }) {
    if (!onClick) return <span className="h-8 w-8" aria-hidden />;
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            title={label}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#94A3B8] transition-colors hover:bg-[#FEF2F2] hover:text-[#DC2626]"
        >
            <X className="h-4 w-4" strokeWidth={2} />
        </button>
    );
}

function floorDisplay(name: string): string {
    const trimmed = name.trim();
    return /^\d+$/.test(trimmed) ? `Floor ${trimmed}` : trimmed;
}

function Segmented<T extends string>({
    value,
    onChange,
    options,
}: {
    value: T;
    onChange: (value: T) => void;
    options: { value: T; label: string; dot?: string }[];
}) {
    return (
        <div
            className="grid gap-1 rounded-lg bg-[#F1F5F9] p-1"
            style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
        >
            {options.map(option => {
                const active = value === option.value;
                return (
                    <button
                        key={option.value}
                        type="button"
                        onClick={() => onChange(option.value)}
                        className={cn(
                            'inline-flex h-8 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-1.5 text-[12.5px] font-medium transition-colors',
                            active
                                ? 'bg-white text-[#0F172A] shadow-[0_1px_2px_rgba(15,23,42,0.08)]'
                                : 'text-[#64748B] hover:text-[#0F172A]',
                        )}
                    >
                        {option.dot ? <span className={cn('h-2 w-2 rounded-full', option.dot)} /> : null}
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}

function GenderSegment({ value, onChange }: { value: string; onChange: (value: string) => void }) {
    return (
        <div>
            <FieldLabel>Gender</FieldLabel>
            <Segmented
                value={value || 'mixed'}
                onChange={onChange}
                options={[
                    { value: 'mixed', label: 'Mixed' },
                    { value: 'female', label: 'Female' },
                    { value: 'male', label: 'Male' },
                ]}
            />
        </div>
    );
}

function resolveLocationLabels(
    context: LayoutContext,
    blocks: Block[],
    rooms: Room[],
): { blockName: string; floorName: string; wardName: string; roomLabel: string } {
    let blockName = context.blockName?.trim() || '';
    let floorName = context.floorName?.trim() || '';
    let wardName = context.wardName?.trim() || '';
    let roomLabel = context.roomLabel?.trim() || '';

    for (const block of blocks) {
        if (context.blockId && block.id === context.blockId && !blockName) blockName = block.name;
        for (const floor of block.floors) {
            if (context.floorId && floor.id === context.floorId) {
                if (!floorName) floorName = floor.name;
                if (!blockName) blockName = block.name;
            }
            for (const ward of floor.wards) {
                if (context.wardId && ward.id === context.wardId && !wardName) {
                    wardName = visibleUnitName(ward.name);
                }
                if (context.roomId) {
                    const embedded = ward.rooms.find(item => item.id === context.roomId);
                    if (embedded && !roomLabel) {
                        roomLabel = embedded.name
                            ? `${embedded.name} · No. ${embedded.number}`
                            : `Room ${embedded.number}`;
                    }
                }
            }
        }
    }

    if (context.roomId && !roomLabel) {
        const match = rooms.find(item => item.id === context.roomId);
        if (match) {
            roomLabel = match.name ? `${match.name} · No. ${match.number}` : `Room ${match.number}`;
        }
    }

    return { blockName, floorName, wardName, roomLabel };
}

function emptyWard(): WardDraft {
    return { name: '', nameChoice: '', code: '', type: '', gender: '' };
}

function emptyRoom(): RoomDraft {
    return { number: '', name: '' };
}

function emptyBed(): BedDraft {
    return { bed_number: '', bed_code: '', status: 'available' };
}

function wardPayload(draft: WardDraft, opts?: { clearOptional?: boolean }): Record<string, unknown> {
    const type = draft.type.trim();
    const code = draft.code.trim();
    const gender = draft.gender.trim();
    // Backend ignores null/"" on PUT, so cleared strings use a sentinel shown as empty in the UI.
    // gender_restriction is an enum and cannot be cleared by the API — omit when empty on edit.
    if (opts?.clearOptional) {
        return {
            name: draft.name.trim(),
            code: optionalForApi(code),
            type: optionalForApi(type),
            ...(gender ? { gender_restriction: gender } : {}),
        };
    }
    return {
        name: draft.name.trim(),
        ...(code ? { code } : {}),
        ...(type ? { type } : {}),
        ...(gender ? { gender_restriction: gender } : {}),
    };
}

function bedPayload(draft: BedDraft, opts?: { clearOptional?: boolean }): Record<string, unknown> {
    const bedCode = draft.bed_code.trim();
    return {
        bed_number: draft.bed_number.trim(),
        ...(opts?.clearOptional
            ? { bed_code: optionalForApi(bedCode) }
            : (bedCode ? { bed_code: bedCode } : {})),
        status: draft.status,
    };
}

/** Finds a room id for this number anywhere in a list or error payload. */
function roomIdForNumber(raw: unknown, number: string): string {
    const want = number.trim().toLowerCase();
    if (!want) return '';
    const seen = new Set<unknown>();
    const visit = (node: unknown): string => {
        if (!node || typeof node !== 'object' || seen.has(node)) return '';
        seen.add(node);
        if (Array.isArray(node)) {
            for (const item of node) {
                const found = visit(item);
                if (found) return found;
            }
            return '';
        }
        const parsed = parseRoom(node);
        if (parsed && parsed.number.trim().toLowerCase() === want) return parsed.id;
        for (const value of Object.values(node as Record<string, unknown>)) {
            const found = visit(value);
            if (found) return found;
        }
        return '';
    };
    const listed = parseRooms(raw).find(item => item.number.trim().toLowerCase() === want);
    return listed?.id || visit(raw);
}

function roomPayload(
    draft: RoomDraft,
    beds?: BedDraft[],
    opts?: { clearOptional?: boolean },
): Record<string, unknown> {
    const usable = (beds || []).filter(bed => bed.bed_number.trim());
    const name = draft.name.trim();
    return {
        number: draft.number.trim(),
        ...(opts?.clearOptional
            ? { name: optionalForApi(name) }
            : (name ? { name } : {})),
        ...(usable.length ? { beds: usable.map(item => bedPayload(item)) } : {}),
    };
}

export default function BedLayoutFormDialog({
    request,
    blocks,
    rooms,
    preview = false,
    onClose,
    onSaved,
    onPreviewOp,
}: {
    request: FormDialogRequest;
    blocks: Block[];
    /** Rooms of the ward in context, for the bed parent picker. */
    rooms: Room[];
    /** Showing the sample layout: apply locally instead of calling the API. */
    preview?: boolean;
    onClose: () => void;
    onSaved: (message: string) => void;
    onPreviewOp?: (op: PreviewOp) => void;
}) {
    const { kind, level } = request;
    const context = useMemo<LayoutContext>(
        () => (request.kind === 'create' ? request.context : {}),
        [request],
    );

    const [blockChoice, setBlockChoice] = useState('');
    const [newBlockName, setNewBlockName] = useState('');
    const [floorChoice, setFloorChoice] = useState('');
    const [newFloorName, setNewFloorName] = useState('');
    const [wardChoice, setWardChoice] = useState('');
    const [bedUnitType, setBedUnitType] = useState('');
    const [bedUnitGender, setBedUnitGender] = useState('');
    const [roomChoice, setRoomChoice] = useState('');

    const [name, setName] = useState('');
    const [ward, setWard] = useState<WardDraft>(emptyWard);
    const [room, setRoom] = useState<RoomDraft>(emptyRoom);
    const [bed, setBed] = useState<BedDraft>(emptyBed);

    const [childFloors, setChildFloors] = useState<{ name: string }[]>([]);
    const [childWards, setChildWards] = useState<WardDraft[]>([]);
    const [childRooms, setChildRooms] = useState<RoomDraft[]>([]);
    const [childBeds, setChildBeds] = useState<BedDraft[]>([]);

    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    /* ── prefill ────────────────────────────────────────────────────── */
    useEffect(() => {
        setError('');
        setBlockChoice(context.blockId || '');
        setFloorChoice(context.floorId || '');
        setWardChoice(context.wardId || '');
        setBedUnitType('');
        setBedUnitGender('');
        setRoomChoice(context.roomId || '');
        setNewBlockName('');
        setNewFloorName('');
        setChildFloors([]);
        setChildWards([]);
        setChildRooms([]);
        setChildBeds([]);

        if (kind === 'edit') {
            if (request.level === 'block') setName(request.entity.name);
            if (request.level === 'floor') setName(request.entity.name);
            if (request.level === 'ward') {
                const entity = request.entity;
                setWard({
                    name: visibleUnitName(entity.name),
                    nameChoice: OTHER,
                    code: optionalFromApi(entity.code),
                    type: optionalFromApi(entity.type),
                    gender: optionalFromApi(entity.gender_restriction),
                });
            }
            if (request.level === 'room') {
                setRoom({ number: request.entity.number, name: optionalFromApi(request.entity.name) });
            }
            if (request.level === 'bed') {
                setBed({
                    bed_number: request.entity.bed_number,
                    bed_code: optionalFromApi(request.entity.bed_code),
                    status: request.entity.status,
                });
            }
            return;
        }

        setName('');
        setWard(emptyWard());
        setRoom(emptyRoom());
        setBed(emptyBed());
        if (level === 'bed' && context.wardId) {
            const existing = blocks.flatMap(block => block.floors.flatMap(floor => floor.wards)).find(item => item.id === context.wardId);
            if (existing) {
                setBedUnitType(existing.type || '');
                setBedUnitGender(existing.gender_restriction || '');
            }
        }
        if (level === 'bed') setChildBeds([]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [request]);

    /* ── cascading options ──────────────────────────────────────────── */
    const selectedBlock = useMemo(
        () => blocks.find(item => item.id === blockChoice) || null,
        [blocks, blockChoice],
    );
    const floorOptions = useMemo(() => selectedBlock?.floors || [], [selectedBlock]);
    const selectedFloor = useMemo(
        () => floorOptions.find(item => item.id === floorChoice) || null,
        [floorOptions, floorChoice],
    );
    const wardOptions = useMemo(() => selectedFloor?.wards || [], [selectedFloor]);
    const selectedWard = useMemo(
        () => wardOptions.find(item => item.id === wardChoice) || null,
        [wardOptions, wardChoice],
    );
    const roomOptions = useMemo(() => {
        // Prefer rooms loaded for the open unit (explorer), then any embedded on the ward node.
        if (context.wardId && context.wardId === wardChoice && rooms.length) return rooms;
        if (selectedWard?.rooms.length) return selectedWard.rooms;
        return context.wardId && context.wardId === wardChoice ? rooms : [];
    }, [selectedWard, rooms, context.wardId, wardChoice]);

    /** Parent fields the form must ask for on create, because the caller didn't supply them. */
    const needs = {
        block: kind === 'create' && level !== 'block' && !context.blockId,
        floor: kind === 'create' && (level === 'ward' || level === 'room' || level === 'bed') && !context.floorId,
        ward: kind === 'create' && (level === 'room' || level === 'bed') && !context.wardId,
        room: kind === 'create' && level === 'bed' && !context.roomId,
    };

    const locationLabels = useMemo(
        () => resolveLocationLabels(context, blocks, rooms),
        [context, blocks, rooms],
    );
    /** Unit type/gender only when inventing a new unit inline — not when picking an existing one. */
    const creatingNewUnit = useMemo(() => {
        if (!(kind === 'create' && needs.ward && (level === 'bed' || level === 'room'))) return false;
        const choice = wardChoice.trim();
        if (!choice) return false;
        return !wardOptions.some(option => option.id === choice);
    }, [kind, needs.ward, level, wardChoice, wardOptions]);

    const dialogIntro = kind === 'create' ? CREATE_INTROS[level] : EDIT_INTROS[level];

    const dialogTitle = kind === 'create' ? LEVEL_TITLES[level].create : LEVEL_TITLES[level].edit;

    const showAssignmentSection = needs.block || needs.floor || needs.ward || needs.room;
    /** Beds can update the unit they go into; rooms only set these when inventing a new unit. */
    const showClassificationSection = creatingNewUnit
        || (kind === 'create' && level === 'bed' && !!(context.wardId || wardChoice.trim()));
    const bedsToCreate = level === 'bed' ? 1 + childBeds.length : 0;
    const submitLabel = kind === 'edit'
        ? 'Save changes'
        : bedsToCreate > 1
            ? `Add ${bedsToCreate} beds`
            : CREATE_CTA[level];

    const savedBuildings = useMemo(
        () => blocks.filter(block => block.name.trim().toLowerCase() !== 'unassigned'),
        [blocks],
    );
    const resolvedFloorName = name.trim();
    const chosenBuildingId = savedBuildings.some(block => block.id === name) ? name : '';
    const floorBlockId = context.blockId
        || (blockChoice && blockChoice !== NEW ? blockChoice : '')
        || (level === 'block' ? chosenBuildingId : '');
    const buildingFloors = useMemo(() => {
        const parent = blocks.find(item => item.id === floorBlockId);
        return (parent?.floors || [])
            .filter(floor => {
                const key = floor.name.trim().toLowerCase();
                return key !== 'unassigned' && key !== 'attached units';
            })
            .sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: 'base' }));
    }, [blocks, floorBlockId]);
    const targetFloorId = context.floorId || (floorChoice && floorChoice !== NEW ? floorChoice : '');
    /** Units already on the floor being edited. The same name may exist on other floors and in other buildings. */
    const unitsOnPlace = useMemo(() => {
        if (!targetFloorId) return [];
        for (const block of blocks) {
            const floor = block.floors.find(item => item.id === targetFloorId);
            if (floor) return floor.wards;
        }
        return [];
    }, [blocks, targetFloorId]);
    const takenFloorNames = useMemo(() => {
        const ignoreId = kind === 'edit' && level === 'floor' ? request.entity.id : '';
        return new Set(
            buildingFloors
                .filter(floor => floor.id !== ignoreId)
                .map(floor => floor.name.trim().toLowerCase()),
        );
    }, [buildingFloors, kind, level, request]);

    const trail = useMemo<TrailNode[]>(() => {
        const pickedRoom = roomOptions.find(item => item.id === roomChoice);
        const typedRoom = roomChoice.trim();
        const parents: Record<LayoutLevel, string> = {
            block: locationLabels.blockName || selectedBlock?.name || (blockChoice === NEW ? newBlockName.trim() : ''),
            floor: floorDisplay(locationLabels.floorName || selectedFloor?.name || (floorChoice === NEW ? newFloorName : '')),
            ward: locationLabels.wardName
                || (selectedWard ? visibleUnitName(selectedWard.name) : visibleUnitName(wardChoice)),
            room: locationLabels.roomLabel
                || (pickedRoom
                    ? (pickedRoom.name ? `${pickedRoom.name} · No. ${pickedRoom.number}` : `Room ${pickedRoom.number}`)
                    : typedRoom ? `Room ${typedRoom}` : ''),
            bed: '',
        };
        const bedNumbers = [bed, ...childBeds].map(item => item.bed_number.trim()).filter(Boolean);
        const current: Record<LayoutLevel, string> = {
            block: savedBuildings.find(block => block.id === name)?.name || name.trim(),
            floor: floorDisplay(name),
            ward: ward.name.trim(),
            room: room.number.trim() ? `Room ${room.number.trim()}` : '',
            bed: bedNumbers.length === 0
                ? ''
                : bedNumbers.length === 1
                    ? `Bed ${bedNumbers[0]}`
                    : `Beds ${bedNumbers.slice(0, 4).join(', ')}${bedNumbers.length > 4 ? ` +${bedNumbers.length - 4}` : ''}`,
        };
        const above = kind === 'create' ? LEVEL_ORDER.slice(0, LEVEL_ORDER.indexOf(level)) : [];
        const savedUnit = selectedWard
            || blocks.flatMap(block => block.floors.flatMap(floor => floor.wards)).find(item => item.id === context.wardId);
        const wardDetail = level === 'bed' || creatingNewUnit
            ? unitDetail(bedUnitType, bedUnitGender)
            : unitDetail(savedUnit?.type || '', savedUnit?.gender_restriction || '');
        return [
            ...above.map(item => ({
                level: item,
                label: LEVEL_NOUNS[item],
                value: parents[item],
                detail: item === 'ward' && parents.ward ? wardDetail : undefined,
            })),
            {
                level,
                label: kind === 'create' ? `New ${LEVEL_NOUNS[level].toLowerCase()}` : LEVEL_NOUNS[level],
                value: current[level],
                current: true,
            },
        ];
    }, [
        kind, level, locationLabels, selectedBlock, selectedFloor, selectedWard, blockChoice, newBlockName,
        floorChoice, newFloorName, wardChoice, roomChoice, roomOptions, bed, childBeds, name, ward, room, savedBuildings,
        blocks, context.wardId, creatingNewUnit, bedUnitType, bedUnitGender,
    ]);

    /* ── submit ─────────────────────────────────────────────────────── */
    /** Sends to the API, or applies the equivalent op to the sample layout. */
    const send = useCallback(async (
        endpoint: string,
        method: 'POST' | 'PUT' | 'PATCH',
        body: Record<string, unknown>,
        op: PreviewOp,
    ) => {
        if (preview) {
            onPreviewOp?.(op);
            return null;
        }
        const url = await appendFacilityIdForProxy(endpoint);
        const res = await fetch(url, {
            method,
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(hierarchyApiMessage(data, `Request failed (${res.status})`));
        return data;
    }, [preview, onPreviewOp]);

    const submit = useCallback(async () => {
        setError('');

        const blockId = context.blockId || (blockChoice && blockChoice !== NEW ? blockChoice : '');
        const floorId = context.floorId || (floorChoice && floorChoice !== NEW ? floorChoice : '');
        const pickedWard = wardOptions.find(item => item.id === wardChoice || sameUnitName(item.name, wardChoice));
        const wardId = context.wardId || pickedWard?.id || '';

        setSaving(true);
        try {
            const resolveNewFloor = async () => {
                if (!blockId) throw new Error('Pick a block or enter a new block name.');
                const floorName = newFloorName.trim();
                const floorBody = { name: floorName };
                try {
                    const createdFloor = await send(API_ENDPOINTS.BLOCK_FLOORS(blockId), 'POST', floorBody, {
                        kind: 'create', level: 'floor', parentId: blockId, body: floorBody,
                    });
                    const createdId = readCreatedId(createdFloor) || (preview ? `preview-floor-${floorName}` : '');
                    if (!createdId) throw new Error('Floor was created, but its id could not be read.');
                    return createdId;
                } catch (err) {
                    const message = err instanceof Error ? err.message : '';
                    if (!/already exists/i.test(message) || preview) throw err;
                    const url = await appendFacilityIdForProxy(API_ENDPOINTS.BLOCK_FLOORS(blockId));
                    const res = await fetch(url, { credentials: 'include' });
                    const data = await res.json().catch(() => ({}));
                    const match = (res.ok ? parseFloors(data) : []).find(floor => floor.name.trim().toLowerCase() === floorName.toLowerCase());
                    if (!match) throw err;
                    return match.id;
                }
            };
            if (kind === 'edit') {
                const id = request.entity.id;
                if (level === 'block') {
                    if (!name.trim()) throw new Error('Block name is required.');
                    const body = { name: name.trim() };
                    await send(API_ENDPOINTS.BLOCK(id), 'PUT', body, { kind: 'edit', level, id, body });
                } else if (level === 'floor') {
                    if (!resolvedFloorName) throw new Error('Floor name is required.');
                    if (takenFloorNames.has(resolvedFloorName.trim().toLowerCase())) {
                        throw new Error(`Floor ${resolvedFloorName} is already on this building. Pick another name.`);
                    }
                    const body = { name: resolvedFloorName };
                    await send(API_ENDPOINTS.FLOOR(id), 'PUT', body, { kind: 'edit', level, id, body });
                } else if (level === 'ward') {
                    if (!ward.name.trim()) throw new Error('Ward name is required.');
                    const body = wardPayload(ward, { clearOptional: true });
                    // Keep the previous gender when the field is left empty — the API enum cannot be cleared.
                    if (!ward.gender.trim() && request.entity.gender_restriction) {
                        body.gender_restriction = request.entity.gender_restriction;
                    }
                    await send(API_ENDPOINTS.WARD(id), 'PUT', body, { kind: 'edit', level, id, body });
                } else if (level === 'room') {
                    if (!room.number.trim()) throw new Error('Room is required.');
                    const body = roomPayload(room, undefined, { clearOptional: true });
                    await send(API_ENDPOINTS.ROOM(id), 'PUT', body, { kind: 'edit', level, id, body });
                } else {
                    if (!bed.bed_number.trim()) throw new Error('Bed number is required.');
                    const body = bedPayload(bed, { clearOptional: true });
                    await send(API_ENDPOINTS.BED(id), 'PATCH', body, { kind: 'edit', level, id, body });
                }
                onSaved(`${LEVEL_TITLES[level].edit.replace('Edit ', '').replace(' info', '')} updated`);
                return;
            }

            if (level === 'block') {
                const floors = childFloors.filter(floor => floor.name.trim());
                const existing = savedBuildings.find(block => block.id === name);
                if (existing) {
                    const taken = new Set(existing.floors.map(floor => floor.name.trim().toLowerCase()));
                    for (const floor of floors) {
                        const floorName = floor.name.trim();
                        if (taken.has(floorName.toLowerCase())) continue;
                        try {
                            await send(API_ENDPOINTS.BLOCK_FLOORS(existing.id), 'POST', { name: floorName }, {
                                kind: 'create', level: 'floor', parentId: existing.id, body: { name: floorName },
                            });
                        } catch (err) {
                            const message = err instanceof Error ? err.message : '';
                            if (!/already exists/i.test(message)) throw err;
                        }
                    }
                    onSaved(floors.length ? 'Floors added' : 'Building already saved');
                    return;
                }
                if (!name.trim()) throw new Error('Building name is required.');
                const body = {
                    name: name.trim(),
                    ...(floors.length ? { floors: floors.map(floor => ({ name: floor.name.trim() })) } : {}),
                };
                await send(API_ENDPOINTS.BLOCKS, 'POST', body, { kind: 'create', level: 'block', body });
                onSaved('Block created');
                return;
            }

            if (level === 'floor') {
                if (!resolvedFloorName) throw new Error('Floor name or number is required.');
                const wards = childWards.filter(item => item.name.trim()).map(item => wardPayload(item));
                const floorBody = { name: resolvedFloorName, ...(wards.length ? { wards } : {}) };
                const alreadyThere = takenFloorNames.has(resolvedFloorName.trim().toLowerCase());
                if (blockId) {
                    if (!alreadyThere) {
                        try {
                            await send(API_ENDPOINTS.BLOCK_FLOORS(blockId), 'POST', floorBody, {
                                kind: 'create', level: 'floor', parentId: blockId, body: floorBody,
                            });
                        } catch (err) {
                            const message = err instanceof Error ? err.message : '';
                            if (!/already exists/i.test(message)) throw err;
                        }
                    }
                } else if (newBlockName.trim()) {
                    const body = { name: newBlockName.trim(), floors: [floorBody] };
                    await send(API_ENDPOINTS.BLOCKS, 'POST', body, { kind: 'create', level: 'block', body });
                } else {
                    throw new Error('Pick a block or enter a new block name.');
                }
                onSaved('Floor created');
                return;
            }

            if (level === 'ward') {
                if (!ward.name.trim()) throw new Error('Ward name is required.');
                if (kind === 'create' && unitsOnPlace.some(unit => sameUnitName(unit.name, ward.name))) {
                    throw new Error('That unit is already on this floor.');
                }
                const roomsPayload = childRooms.filter(item => item.number.trim()).map(item => roomPayload(item));
                const wardBody = { ...wardPayload(ward), ...(roomsPayload.length ? { rooms: roomsPayload } : {}) };
                if (floorId) {
                    try {
                        await send(API_ENDPOINTS.FLOOR_WARDS(floorId), 'POST', wardBody, {
                            kind: 'create', level: 'ward', parentId: floorId, body: wardBody,
                        });
                    } catch (err) {
                        const message = err instanceof Error ? err.message : '';
                        if (!/already exists/i.test(message) || preview) throw err;
                        const aliased = { ...wardBody, name: unitNameForFloor(ward.name, floorId) };
                        await send(API_ENDPOINTS.FLOOR_WARDS(floorId), 'POST', aliased, {
                            kind: 'create', level: 'ward', parentId: floorId, body: aliased,
                        });
                    }
                } else if (blockId && newFloorName.trim()) {
                    const body = { name: newFloorName.trim(), wards: [wardBody] };
                    await send(API_ENDPOINTS.BLOCK_FLOORS(blockId), 'POST', body, {
                        kind: 'create', level: 'floor', parentId: blockId, body,
                    });
                } else if (newBlockName.trim() && newFloorName.trim()) {
                    const body = {
                        name: newBlockName.trim(),
                        floors: [{ name: newFloorName.trim(), wards: [wardBody] }],
                    };
                    await send(API_ENDPOINTS.BLOCKS, 'POST', body, { kind: 'create', level: 'block', body });
                } else {
                    throw new Error('Pick the block and floor this ward belongs to.');
                }
                onSaved('Ward created');
                return;
            }

            if (level === 'room') {
                if (!room.number.trim()) throw new Error('Room is required.');
                let resolvedFloorId = floorId;
                if (!resolvedFloorId && newFloorName.trim()) {
                    resolvedFloorId = await resolveNewFloor();
                }
                let resolvedWardId = wardId;
                const typedUnit = wardChoice.trim();
                if (!resolvedWardId && typedUnit) {
                    if (!resolvedFloorId) throw new Error('Pick the floor this unit belongs to.');
                    const unitType = bedUnitType.trim();
                    const unitGender = bedUnitGender.trim();
                    if (!unitGender) throw new Error('Choose a gender restriction.');
                    const createUnit = async (name: string) => {
                        const wardBody = {
                            name,
                            ...(unitType ? { type: unitType } : {}),
                            gender_restriction: unitGender,
                        };
                        const createdWard = await send(API_ENDPOINTS.FLOOR_WARDS(resolvedFloorId), 'POST', wardBody, {
                            kind: 'create', level: 'ward', parentId: resolvedFloorId, body: wardBody,
                        });
                        return readCreatedId(createdWard) || (preview ? `preview-ward-${visibleUnitName(name)}` : '');
                    };
                    try {
                        resolvedWardId = await createUnit(typedUnit);
                    } catch (err) {
                        const message = err instanceof Error ? err.message : '';
                        if (!/already exists/i.test(message) || preview) throw err;
                        resolvedWardId = await createUnit(unitNameForFloor(typedUnit, resolvedFloorId));
                    }
                    if (!resolvedWardId) throw new Error('Unit was created, but its id could not be read.');
                }
                if (!resolvedWardId) throw new Error(typedUnit ? 'Pick a unit on this floor.' : 'Pick the ward this room belongs to.');
                const addingBeds = childBeds.some(item => item.bed_number.trim());
                if (addingBeds && childBeds.filter(item => item.bed_number.trim()).length > NESTED_LIMITS.bedsPerRoom) {
                    throw new Error(`A room can include up to ${NESTED_LIMITS.bedsPerRoom} beds.`);
                }
                const body = roomPayload(room, childBeds);
                await send(API_ENDPOINTS.WARD_ROOMS(resolvedWardId), 'POST', body, {
                    kind: 'create', level: 'room', parentId: resolvedWardId, body,
                });
                onSaved('Room created');
                return;
            }

            let resolvedFloorId = floorId;
            if (!resolvedFloorId && newFloorName.trim()) {
                resolvedFloorId = await resolveNewFloor();
            }
            const unitName = wardChoice.trim();
            const hiddenFloor = (name: string) => {
                const key = name.trim().toLowerCase();
                return key === 'unassigned' || key === 'attached units';
            };
            const placedUnit = blocks.flatMap(block => block.floors.flatMap(floor => floor.wards
                .filter(item => sameUnitName(item.name, unitName))
                .map(item => ({
                    id: item.id,
                    name: item.name,
                    type: item.type || '',
                    floorId: item.floor_id || floor.id,
                    onListedFloor: !hiddenFloor(floor.name),
                }))));
            const onThisFloor = placedUnit.find(item => item.floorId === resolvedFloorId);
            const selectedUnit = blocks.flatMap(block => block.floors.flatMap(floor => floor.wards)).find(item => item.id === wardId || item.id === wardChoice);
            const knownUnit = onThisFloor
                || (selectedUnit && (selectedUnit.floor_id || '') === resolvedFloorId
                    ? { id: selectedUnit.id, name: selectedUnit.name, type: selectedUnit.type || '', floorId: selectedUnit.floor_id || resolvedFloorId, onListedFloor: true }
                    : undefined);
            const unitType = bedUnitType.trim() || knownUnit?.type || '';
            const unitGender = bedUnitGender.trim();
            const unitBody = (name: string, floor: string, forEdit = false) => ({
                name,
                ...(floor ? { floor_id: floor } : {}),
                ...(forEdit
                    ? {
                        type: optionalForApi(unitType),
                        ...(unitGender ? { gender_restriction: unitGender } : {}),
                    }
                    : {
                        ...(unitType ? { type: unitType } : {}),
                        ...(unitGender ? { gender_restriction: unitGender } : {}),
                    }),
            });
            let resolvedWardId = wardId || (knownUnit?.floorId === resolvedFloorId ? knownUnit.id : '') || '';
            if (!resolvedWardId && unitName) {
                if (!resolvedFloorId) throw new Error('Pick the floor this unit belongs to.');
                if (knownUnit) {
                    const body = unitBody(knownUnit.name, resolvedFloorId, true);
                    await send(API_ENDPOINTS.WARD(knownUnit.id), 'PUT', body, {
                        kind: 'edit', level: 'ward', id: knownUnit.id, body,
                    });
                    resolvedWardId = knownUnit.id;
                } else {
                    const wardBody = unitBody(unitName, resolvedFloorId);
                    try {
                        const createdWard = await send(API_ENDPOINTS.FLOOR_WARDS(resolvedFloorId), 'POST', wardBody, {
                            kind: 'create', level: 'ward', parentId: resolvedFloorId, body: wardBody,
                        });
                        resolvedWardId = readCreatedId(createdWard) || (preview ? `preview-ward-${unitName}` : '');
                    } catch (err) {
                        const message = err instanceof Error ? err.message : '';
                        if (!/already exists/i.test(message) || preview) throw err;
                        const url = await appendFacilityIdForProxy(API_ENDPOINTS.FLOOR_WARDS(resolvedFloorId));
                        const res = await fetch(url, { credentials: 'include' });
                        const data = await res.json().catch(() => ({}));
                        const here = (res.ok ? parseWards(data) : []).find(item => sameUnitName(item.name, unitName));
                        if (here) {
                            resolvedWardId = here.id;
                        } else {
                            const aliased = unitBody(unitNameForFloor(unitName, resolvedFloorId), resolvedFloorId);
                            try {
                                const createdWard = await send(API_ENDPOINTS.FLOOR_WARDS(resolvedFloorId), 'POST', aliased, {
                                    kind: 'create', level: 'ward', parentId: resolvedFloorId, body: aliased,
                                });
                                resolvedWardId = readCreatedId(createdWard) || '';
                            } catch (retryErr) {
                                const retryMessage = retryErr instanceof Error ? retryErr.message : '';
                                if (!/already exists/i.test(retryMessage)) throw retryErr;
                                const again = await fetch(url, { credentials: 'include' });
                                const againData = await again.json().catch(() => ({}));
                                const placed = (again.ok ? parseWards(againData) : []).find(item => sameUnitName(item.name, unitName));
                                if (!placed) throw err;
                                resolvedWardId = placed.id;
                            }
                        }
                    }
                    if (!resolvedWardId) throw new Error('Unit was created, but its id could not be read.');
                }
            } else if (resolvedWardId) {
                const savedUnit = blocks.flatMap(block => block.floors.flatMap(floor => floor.wards)).find(item => item.id === resolvedWardId);
                const unitChanged = !savedUnit
                    || unitType !== (savedUnit.type || '')
                    || (!!unitGender && unitGender !== (savedUnit.gender_restriction || ''));
                const named = knownUnit?.name || savedUnit?.name || (context.wardId ? '' : unitName);
                if (named && unitChanged) {
                    const body = unitBody(named, resolvedFloorId, true);
                    await send(API_ENDPOINTS.WARD(resolvedWardId), 'PUT', body, {
                        kind: 'edit', level: 'ward', id: resolvedWardId, body,
                    });
                }
            }
            if (!resolvedWardId) throw new Error('Pick the ward this bed belongs to.');
            if (!context.roomId && !roomChoice.trim()) {
                throw new Error('Room is required.');
            }
            if ([bed, ...childBeds].some(item => item.bed_number.trim() && !BED_STATUS_META[item.status])) {
                throw new Error('Choose a bed status.');
            }
            const beds = [bed, ...childBeds].filter(item => item.bed_number.trim());
            if (!beds.length) throw new Error('Bed number is required.');
            if (beds.length > NESTED_LIMITS.bedsPerRoom) {
                throw new Error(`A room can include up to ${NESTED_LIMITS.bedsPerRoom} beds.`);
            }
            const typedRoom = roomChoice.trim();
            const unitOnThisFloor = blocks.flatMap(block => block.floors
                .filter(floor => floor.id === resolvedFloorId)
                .flatMap(floor => floor.wards))
                .find(item => item.id === resolvedWardId);
            const sameNumber = (item: { id: string; number: string }) => (
                item.id === context.roomId
                || item.id === typedRoom
                || item.number.trim().toLowerCase() === typedRoom.toLowerCase()
            );
            const existingRoom = unitOnThisFloor?.rooms.find(sameNumber)
                || roomOptions.find(item => item.ward_id === resolvedWardId && sameNumber(item));
            const roomNumber = (existingRoom?.number || typedRoom).trim();
            if (!roomNumber) throw new Error('Room is required.');
            let resolvedRoomId = existingRoom?.id || '';
            if (!resolvedRoomId) {
                const body = { number: roomNumber };
                if (preview) {
                    onPreviewOp?.({ kind: 'create', level: 'room', parentId: resolvedWardId, body });
                    resolvedRoomId = `preview-room-${roomNumber}`;
                } else {
                    const url = await appendFacilityIdForProxy(API_ENDPOINTS.WARD_ROOMS(resolvedWardId));
                    const res = await fetch(url, {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (res.ok) {
                        resolvedRoomId = readCreatedId(data);
                    } else if (res.status === 409 || /already exists/i.test(hierarchyApiMessage(data, ''))) {
                        resolvedRoomId = roomIdForNumber(data, roomNumber);
                        if (!resolvedRoomId) {
                            const listUrl = await appendFacilityIdForProxy(API_ENDPOINTS.WARD_ROOMS(resolvedWardId));
                            const listed = await fetch(listUrl, { credentials: 'include' });
                            const listedData = await listed.json().catch(() => ({}));
                            resolvedRoomId = listed.ok ? roomIdForNumber(listedData, roomNumber) : '';
                        }
                        if (!resolvedRoomId) {
                            const byWard = await appendFacilityIdForProxy(`${API_ENDPOINTS.ROOMS}?ward_id=${encodeURIComponent(resolvedWardId)}`);
                            const listed = await fetch(byWard, { credentials: 'include' });
                            const listedData = await listed.json().catch(() => ({}));
                            resolvedRoomId = listed.ok ? roomIdForNumber(listedData, roomNumber) : '';
                        }
                    } else {
                        throw new Error(hierarchyApiMessage(data, `Request failed (${res.status})`));
                    }
                }
                if (!resolvedRoomId) throw new Error('Room was created, but its id could not be read.');
            }
            const body = { beds: beds.map(item => bedPayload(item)) };
            await send(API_ENDPOINTS.ROOM_BEDS(resolvedRoomId), 'POST', body, {
                kind: 'create', level: 'bed', parentId: resolvedRoomId, body,
            });
            onSaved(beds.length === 1 ? 'Bed added' : `${beds.length} beds added`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong.');
        } finally {
            setSaving(false);
        }
    }, [
        kind, level, request, context, blockChoice, floorChoice, wardChoice, roomChoice,
        name, resolvedFloorName, ward, room, bed, childFloors, childWards, childRooms, childBeds,
        newBlockName, newFloorName, send, onSaved, onPreviewOp, bedUnitType, bedUnitGender,
        takenFloorNames, savedBuildings, unitsOnPlace, wardOptions, roomOptions, preview, blocks,
    ]);

    /* ── field renderers ────────────────────────────────────────────── */
    const floorNameOptions = (current: string, extraTaken: Iterable<string> = []) => {
        const blocked = new Set(extraTaken);
        const existing = buildingFloors
            .filter(floor => !blocked.has(floor.name.trim().toLowerCase()))
            .map(floor => ({ label: floor.name, value: floor.name }));
        const used = new Set(existing.map(option => option.value.toLowerCase()));
        const numbers = Array.from({ length: 10 }, (_, i) => String(i + 1))
            .filter(value => !used.has(value.toLowerCase()) && !blocked.has(value.toLowerCase()))
            .map(value => ({ label: value, value }));
        const options = [...existing, ...numbers];
        const typed = current.trim();
        if (typed && !options.some(option => option.value.toLowerCase() === typed.toLowerCase())) {
            return [{ label: typed, value: typed }, ...options];
        }
        return options;
    };

    const floorNameSelect = (value: string, onChange: (next: string) => void, extraTaken?: Iterable<string>) => (
        <CustomSelect
            value={value}
            onChange={onChange}
            options={floorNameOptions(value, extraTaken)}
            placeholder="Choose a floor"
            allowCustom
            customEntryTitle=""
            customPlaceholder="Search or type a floor"
            style={fieldSelectStyle}
            maxH={280}
        />
    );

    const buildingOptions = (current: string) => {
        const listed = savedBuildings.map(block => ({ label: block.name, value: block.id }));
        const typed = current.trim();
        if (typed && !savedBuildings.some(block => block.id === typed || block.name.trim().toLowerCase() === typed.toLowerCase())) {
            return [{ label: typed, value: typed }, ...listed];
        }
        return listed;
    };

    const buildingSelect = (value: string, onChange: (next: string) => void) => (
        <CustomSelect
            value={value}
            onChange={next => {
                const match = savedBuildings.find(block => block.id === next || block.name.trim().toLowerCase() === next.trim().toLowerCase());
                onChange(match ? match.id : next);
            }}
            options={buildingOptions(value)}
            placeholder="Choose a building"
            allowCustom
            customEntryTitle=""
            customPlaceholder="Search or type a building"
            style={fieldSelectStyle}
            maxH={280}
        />
    );

    const floorNameField = (
        <div>
            <FieldLabel>Floor</FieldLabel>
            {floorNameSelect(name, setName)}
        </div>
    );

    const wardFields = (draft: WardDraft, update: (next: WardDraft) => void) => (
        <div className="grid gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                    <FieldLabel>Unit name</FieldLabel>
                    {kind === 'edit' || unitsOnPlace.length === 0 ? (
                        <Input
                            value={draft.name}
                            onChange={e => update({ ...draft, nameChoice: OTHER, name: e.target.value })}
                            placeholder="e.g. Labour & Delivery Unit"
                        />
                    ) : (
                        <CustomSelect
                            value={draft.nameChoice && draft.nameChoice !== OTHER ? draft.nameChoice : draft.name}
                            onChange={value => {
                                const picked = unitsOnPlace.find(unit => unit.id === value || sameUnitName(unit.name, value));
                                update({
                                    ...draft,
                                    nameChoice: picked ? picked.id : OTHER,
                                    name: picked ? visibleUnitName(picked.name) : value,
                                });
                            }}
                            options={(() => {
                                const listed = unitsOnPlace.map(unit => ({
                                    label: visibleUnitName(unit.name),
                                    value: unit.id,
                                }));
                                const typed = draft.name.trim();
                                if (typed && !unitsOnPlace.some(unit => sameUnitName(unit.name, typed))) {
                                    return [{ label: typed, value: typed }, ...listed];
                                }
                                // Keep the closed trigger readable when value is a unit id.
                                if (
                                    draft.nameChoice
                                    && draft.nameChoice !== OTHER
                                    && typed
                                    && !listed.some(option => option.value === draft.nameChoice)
                                ) {
                                    return [{ label: typed, value: draft.nameChoice }, ...listed];
                                }
                                return listed;
                            })()}
                            placeholder="Choose a unit"
                            allowCustom
                            customEntryTitle=""
                            customPlaceholder="Search or type a new unit"
                            style={fieldSelectStyle}
                            maxH={240}
                        />
                    )}
                </div>
                <div>
                    <FieldLabel optional>Unit code</FieldLabel>
                    <Input
                        value={draft.code}
                        onChange={e => update({ ...draft, code: e.target.value })}
                        placeholder="e.g. BMT"
                    />
                </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                    <FieldLabel optional>Unit type</FieldLabel>
                    <CustomSelect
                        value={draft.type}
                        onChange={type => update({ ...draft, type })}
                        options={(() => {
                            const listed = WARD_TYPES.map(type => ({ label: wardTypeLabel(type), value: type }));
                            const typed = draft.type.trim();
                            if (typed && !(WARD_TYPES as readonly string[]).includes(typed)) {
                                return [{ label: typed, value: typed }, ...listed];
                            }
                            return listed;
                        })()}
                        placeholder="Optional"
                        allowCustom
                        allowClear
                        clearLabel="No type"
                        customEntryTitle=""
                        customPlaceholder="Search or type a unit type"
                        style={fieldSelectStyle}
                        maxH={280}
                    />
                </div>
                <div>
                    <GenderSegment
                        value={draft.gender || 'mixed'}
                        onChange={gender => update({ ...draft, gender })}
                    />
                </div>
            </div>
        </div>
    );

    const roomFields = (draft: RoomDraft, update: (next: RoomDraft) => void) => (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
                <FieldLabel>Room number</FieldLabel>
                <Input
                    value={draft.number}
                    onChange={e => update({ ...draft, number: e.target.value })}
                    placeholder="e.g. 101"
                />
            </div>
            <div>
                <FieldLabel optional>Room name</FieldLabel>
                <Input
                    value={draft.name}
                    onChange={e => update({ ...draft, name: e.target.value })}
                    placeholder="e.g. Isolation room"
                />
            </div>
        </div>
    );

    const suggestedBedCode = (draft: BedDraft) => {
        const roomHint = (level === 'room' ? room.number.trim() : '')
            || roomOptions.find(item => item.id === roomChoice)?.number
            || locationLabels.roomLabel.replace(/^.*No\.\s*|^Room\s+/i, '')
            || roomChoice.trim()
            || 'BED';
        return `${String(roomHint).replace(/\s+/g, '').toUpperCase()}-${draft.bed_number.trim()}`;
    };

    const bedRow = (key: string, draft: BedDraft, update: (next: BedDraft) => void, onRemove: (() => void) | null) => {
        const canGenerateCode = !draft.bed_code.trim() && !!draft.bed_number.trim();
        return (
            <div key={key} className={cn('grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_32px] items-center gap-2 px-3 py-2.5', BED_GRID)}>
                <Input
                    aria-label="Bed number"
                    value={draft.bed_number}
                    onChange={e => update({ ...draft, bed_number: e.target.value })}
                    placeholder="e.g. 04"
                />
                <div className="relative min-w-0">
                    <Input
                        aria-label="Bed code"
                        value={draft.bed_code}
                        onChange={e => update({ ...draft, bed_code: e.target.value })}
                        placeholder="e.g. 110-04"
                        className={cn(canGenerateCode && 'pr-9')}
                    />
                    {canGenerateCode ? (
                        <button
                            type="button"
                            onClick={() => update({ ...draft, bed_code: suggestedBedCode(draft) })}
                            aria-label="Fill in a code from the room and bed number"
                            title={`Use ${suggestedBedCode(draft)}`}
                            className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[#94A3B8] transition-colors hover:bg-[#F1F5F9] hover:text-[#1E3A5F]"
                        >
                            <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
                        </button>
                    ) : null}
                </div>
                <div className="order-4 col-span-3 min-w-0 sm:order-0 sm:col-span-1">
                    <Segmented
                        value={draft.status}
                        onChange={status => update({ ...draft, status })}
                        options={BED_STATUS_OPTIONS}
                    />
                </div>
                <div className="order-3 flex justify-end sm:order-0">
                    <RemoveButton label="Remove this bed" onClick={onRemove} />
                </div>
            </div>
        );
    };

    const bedHeader: ReactNode[] = ['Bed number', <>Code <OptionalTag /></>, 'Status', ''];

    const unitCard = (key: string, title: string, onRemove: () => void, children: ReactNode) => (
        <div key={key} className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between gap-3 border-b border-[#EEF2F7] bg-[#F8FAFC] py-1.5 pl-4 pr-2">
                <span className="text-[12.5px] font-semibold text-[#334155]">{title}</span>
                <RemoveButton label={`Remove ${title}`} onClick={onRemove} />
            </div>
            <div className="p-4">{children}</div>
        </div>
    );

    const removeBedAt = (index: number) => {
        if (index === 0) {
            if (!childBeds.length) return;
            setBed(childBeds[0]);
            setChildBeds(prev => prev.slice(1));
            return;
        }
        setChildBeds(prev => prev.filter((_, i) => i !== index - 1));
    };

    const assignmentFields = showAssignmentSection ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {needs.block && (
                <div className={needs.floor ? undefined : 'sm:col-span-2'}>
                    <FieldLabel>Building</FieldLabel>
                    {buildingSelect(blockChoice === NEW ? newBlockName : blockChoice, value => {
                        const match = savedBuildings.find(block => block.id === value);
                        setBlockChoice(match ? match.id : value ? NEW : '');
                        setNewBlockName(match ? '' : value);
                        setFloorChoice('');
                        setWardChoice('');
                        setRoomChoice('');
                    })}
                </div>
            )}
            {needs.floor && (
                <div className={needs.block ? undefined : 'sm:col-span-2'}>
                    <FieldLabel>Floor</FieldLabel>
                    <CustomSelect
                        value={floorChoice === NEW ? newFloorName : floorChoice}
                        disabled={!blockChoice && !context.blockId}
                        onChange={value => {
                            const match = floorOptions.find(floor => floor.id === value || floor.name.trim().toLowerCase() === value.trim().toLowerCase());
                            setFloorChoice(match ? match.id : value ? NEW : '');
                            setNewFloorName(match ? '' : value);
                            setWardChoice('');
                            setRoomChoice('');
                        }}
                        options={(() => {
                            const listed = floorOptions
                                .filter(floor => {
                                    const key = floor.name.trim().toLowerCase();
                                    return key !== 'unassigned' && key !== 'attached units';
                                })
                                .sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: 'base' }))
                                .map(floor => ({ label: floor.name, value: floor.id }));
                            const used = new Set(listed.map(option => option.label.toLowerCase()));
                            const numbers = Array.from({ length: 10 }, (_, index) => String(index + 1))
                                .filter(value => !used.has(value))
                                .map(value => ({ label: value, value }));
                            return withTypedOption([...listed, ...numbers], floorChoice === NEW ? newFloorName : '');
                        })()}
                        placeholder={(blockChoice || context.blockId) ? 'Choose a floor' : 'Choose a building first'}
                        allowCustom
                        customEntryTitle=""
                        customPlaceholder="Search or type a floor"
                        style={fieldSelectStyle}
                        maxH={280}
                    />
                </div>
            )}
            {needs.ward && (
                <div className={needs.room || creatingNewUnit ? undefined : 'sm:col-span-2'}>
                    <FieldLabel>Unit</FieldLabel>
                    <CustomSelect
                        value={wardChoice}
                        disabled={!(floorChoice || context.floorId) || (floorChoice === NEW && !newFloorName.trim())}
                        onChange={value => {
                            const match = matchedOption(value, wardOptions.map(option => ({ label: option.name, value: option.id })));
                            const picked = match ? wardOptions.find(option => option.id === match.value) : undefined;
                            setWardChoice(match ? match.value : value);
                            setRoomChoice('');
                            if (picked) {
                                setBedUnitType(picked.type || '');
                                setBedUnitGender(picked.gender_restriction || '');
                            } else {
                                setBedUnitType('');
                                setBedUnitGender(value.trim() ? 'mixed' : '');
                            }
                        }}
                        options={withTypedOption(
                            wardOptions.map(option => ({ label: visibleUnitName(option.name), value: option.id })),
                            wardChoice,
                        )}
                        placeholder={(floorChoice || context.floorId) && (floorChoice !== NEW || newFloorName.trim()) ? 'Choose a unit' : 'Choose a floor first'}
                        allowCustom
                        customEntryTitle=""
                        customPlaceholder="Search or type a new unit"
                        style={fieldSelectStyle}
                        maxH={280}
                    />
                </div>
            )}
            {needs.room && (
                <div className={needs.ward ? undefined : 'sm:col-span-2'}>
                    <FieldLabel>Room</FieldLabel>
                    <CustomSelect
                        value={roomChoice}
                        disabled={!wardChoice && !context.wardId}
                        onChange={value => {
                            const match = roomOptions.find(option => (
                                option.id === value || option.number.trim().toLowerCase() === value.trim().toLowerCase()
                            ));
                            setRoomChoice(match ? match.id : value);
                        }}
                        options={withTypedOption(
                            roomOptions.map(option => ({
                                label: option.name ? `${option.number} · ${option.name}` : option.number,
                                value: option.id,
                            })),
                            roomChoice,
                        )}
                        placeholder={wardChoice || context.wardId ? 'Choose a room' : 'Choose a unit first'}
                        allowCustom
                        customEntryTitle=""
                        customPlaceholder="Search or type a room number"
                        style={fieldSelectStyle}
                        maxH={240}
                    />
                </div>
            )}
        </div>
    ) : null;

    const hasChildSection = kind === 'create' && level !== 'bed';
    const sectionOrder = [
        showAssignmentSection ? 'location' : '',
        showClassificationSection ? 'unit' : '',
        'details',
        hasChildSection ? 'children' : '',
    ].filter(Boolean);
    const stepOf = (id: string) => (sectionOrder.length > 1 ? sectionOrder.indexOf(id) + 1 : undefined);

    const DETAIL_COPY: Record<LayoutLevel, { title: string; description: string }> = {
        block: {
            title: 'Building',
            description: kind === 'create'
                ? 'Pick an existing building to add floors to it, or type a new name.'
                : 'The name staff see across the facility.',
        },
        floor: { title: 'Floor', description: 'Pick a floor number, or type a name such as Ground.' },
        ward: { title: 'Unit details', description: 'Name the unit and choose who it serves.' },
        room: { title: 'Room details', description: 'Use the number shown on the door.' },
        bed: {
            title: kind === 'create' && bedsToCreate > 1 ? 'Beds' : 'Bed',
            description: kind === 'create'
                ? 'Give each bed a number. Add rows to create several at once.'
                : 'The bed number, an optional code, and its current status.',
        },
    };

    return (
        // Non-modal: CustomSelect portals its list to <body>, and a modal dialog would block clicks, focus and scroll there.
        <Dialog open modal={false} onOpenChange={open => { if (!open) onClose(); }}>
            <DialogContent
                showClose
                className="w-[min(920px,calc(100%-2rem))] flex-row gap-0 p-0"
                onInteractOutside={event => {
                    const target = event.target as Element | null;
                    if (target?.closest?.('[data-custom-select-panel]')) event.preventDefault();
                }}
            >
                <aside className="hidden w-[268px] shrink-0 flex-col border-r border-[#EDF1F6] bg-[#F8FAFC] px-6 py-7 md:flex">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF0F7] text-[#1E3A5F] ring-1 ring-[#1E3A5F]/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_2px_rgba(15,23,42,0.06)]">
                        {levelIcon(level, 'h-5 w-5')}
                    </div>
                    <DialogTitle asChild>
                        <div className="mt-4 text-[19px] font-semibold leading-7 tracking-[-0.015em] text-[#0F172A]">
                            {dialogTitle}
                        </div>
                    </DialogTitle>
                    <DialogDescription className="mt-1.5 text-[13px] leading-5 text-[#64748B]">
                        {dialogIntro}
                    </DialogDescription>

                    <div className="mt-7 min-w-0 border-t border-[#E8EEF5] pt-5">
                        <div className="mb-3.5 text-[12px] font-medium text-[#64748B]">
                            {kind === 'create' ? 'Placement' : 'Item'}
                        </div>
                        <PlacementTrail nodes={trail} />
                    </div>
                </aside>

                <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                    <div className="border-b border-[#EEF2F7] px-5 py-4 pr-12 md:hidden">
                        <div className="text-[16px] font-semibold text-[#0F172A]">{dialogTitle}</div>
                        <p className="mt-0.5 text-[12.5px] text-[#64748B]">{dialogIntro}</p>
                    </div>

                <DialogBody className="content-start gap-7 px-5 py-6 md:px-8 md:pb-8 md:pt-8">
                    {showAssignmentSection && (
                        <Section step={stepOf('location')} title="Location" description="Where this goes in the facility.">
                            {assignmentFields}
                        </Section>
                    )}

                    {showClassificationSection && (
                        <Section
                            step={stepOf('unit')}
                            title={creatingNewUnit ? 'New unit' : 'Unit settings'}
                            description={creatingNewUnit
                                ? 'This unit doesn’t exist yet, so it will be created with these settings.'
                                : 'Applies to every room and bed in this unit.'}
                        >
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div>
                                    <FieldLabel optional>Unit type</FieldLabel>
                                    <CustomSelect
                                        value={bedUnitType}
                                        onChange={setBedUnitType}
                                        options={(() => {
                                            const listed = WARD_TYPES.map(type => ({ label: wardTypeLabel(type), value: type }));
                                            const typed = bedUnitType.trim();
                                            if (typed && !(WARD_TYPES as readonly string[]).includes(typed)) {
                                                return [{ label: typed, value: typed }, ...listed];
                                            }
                                            return listed;
                                        })()}
                                        placeholder="Choose a type"
                                        allowCustom
                                        allowClear
                                        clearLabel="No type"
                                        customEntryTitle=""
                                        customPlaceholder="Search or type a unit type"
                                        style={fieldSelectStyle}
                                        maxH={280}
                                    />
                                </div>
                                <GenderSegment
                                    value={bedUnitGender || 'mixed'}
                                    onChange={setBedUnitGender}
                                />
                            </div>
                        </Section>
                    )}

                    {level === 'bed' ? (
                        <Section step={stepOf('details')} title={DETAIL_COPY.bed.title} description={DETAIL_COPY.bed.description}>
                            <div className="grid gap-2">
                                <ListShell
                                    header={bedHeader}
                                    grid={BED_GRID}
                                    footer={kind === 'create' ? (
                                        <ListAddRow
                                            label="Add another bed"
                                            count={bedsToCreate}
                                            limit={NESTED_LIMITS.bedsPerRoom}
                                            onClick={() => setChildBeds(prev => [...prev, emptyBed()])}
                                        />
                                    ) : undefined}
                                >
                                    {[bed, ...childBeds].map((draft, index) => bedRow(
                                        `bed-${index}`,
                                        draft,
                                        next => (index === 0
                                            ? setBed(next)
                                            : setChildBeds(prev => prev.map((item, i) => i === index - 1 ? next : item))),
                                        kind === 'create' && bedsToCreate > 1 ? () => removeBedAt(index) : null,
                                    ))}
                                </ListShell>
                                <p className="text-[12px] leading-5 text-[#64748B]">
                                    Unavailable beds are out of service and can’t be assigned to patients.
                                </p>
                            </div>
                        </Section>
                    ) : (
                    <Section step={stepOf('details')} title={DETAIL_COPY[level].title} description={DETAIL_COPY[level].description}>
                        {level === 'block' && (
                            <div>
                                <FieldLabel>Building name</FieldLabel>
                                {kind === 'edit' ? (
                                    <Input
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        placeholder="e.g. Maternity Block"
                                    />
                                ) : buildingSelect(name, setName)}
                            </div>
                        )}
                        {level === 'floor' && floorNameField}
                        {level === 'ward' && wardFields(ward, setWard)}
                        {level === 'room' && roomFields(room, setRoom)}
                    </Section>
                    )}

                    {kind === 'create' && level === 'block' && (
                        <Section step={stepOf('children')} title="Floors" optional description="Add the floors in this building now, or later from the layout.">
                            <ListShell
                                header={['Floor', '']}
                                grid={FLOOR_GRID}
                                empty={childFloors.length ? undefined : 'No floors yet. You can also add them later.'}
                                footer={(
                                    <ListAddRow
                                        label={childFloors.length ? 'Add another floor' : 'Add a floor'}
                                        count={childFloors.length}
                                        limit={NESTED_LIMITS.floorsPerBlock}
                                        onClick={() => setChildFloors(prev => [...prev, { name: '' }])}
                                    />
                                )}
                            >
                                {childFloors.map((floor, index) => (
                                    <div key={`floor-${index}`} className={cn('grid grid-cols-[minmax(0,1fr)_32px] items-center gap-2 px-3 py-2.5', FLOOR_GRID)}>
                                        {floorNameSelect(
                                            floor.name,
                                            value => setChildFloors(prev => prev.map((item, i) => i === index ? { ...item, name: value } : item)),
                                            childFloors.flatMap((item, i) => i === index || !item.name.trim() ? [] : [item.name.trim().toLowerCase()]),
                                        )}
                                        <RemoveButton
                                            label="Remove this floor"
                                            onClick={() => setChildFloors(prev => prev.filter((_, i) => i !== index))}
                                        />
                                    </div>
                                ))}
                            </ListShell>
                        </Section>
                    )}

                    {kind === 'create' && level === 'floor' && (
                        <Section step={stepOf('children')} title="Units on this floor" optional description="Wards or departments on this floor, such as Maternity or ICU.">
                            <div className="grid gap-3">
                                {childWards.map((draft, index) => unitCard(
                                    `ward-${index}`,
                                    `Unit ${index + 1}`,
                                    () => setChildWards(prev => prev.filter((_, i) => i !== index)),
                                    wardFields(draft, next => setChildWards(prev => prev.map((item, i) => i === index ? next : item))),
                                ))}
                                <ListShell
                                    header={[]}
                                    grid=""
                                    empty={childWards.length ? undefined : 'No units yet. You can also add them later.'}
                                    footer={(
                                        <ListAddRow
                                            label={childWards.length ? 'Add another unit' : 'Add a unit'}
                                            count={childWards.length}
                                            limit={NESTED_LIMITS.wardsPerFloor}
                                            onClick={() => setChildWards(prev => [...prev, emptyWard()])}
                                        />
                                    )}
                                />
                            </div>
                        </Section>
                    )}

                    {kind === 'create' && level === 'ward' && (
                        <Section step={stepOf('children')} title="Rooms in this unit" optional description="Add the rooms now, or later from the unit page.">
                            <ListShell
                                header={['Room number', <>Name <OptionalTag /></>, '']}
                                grid={ROOM_GRID}
                                empty={childRooms.length ? undefined : 'No rooms yet. You can also add them later.'}
                                footer={(
                                    <ListAddRow
                                        label={childRooms.length ? 'Add another room' : 'Add a room'}
                                        count={childRooms.length}
                                        limit={NESTED_LIMITS.roomsPerWard}
                                        onClick={() => setChildRooms(prev => [...prev, emptyRoom()])}
                                    />
                                )}
                            >
                                {childRooms.map((draft, index) => {
                                    const update = (next: RoomDraft) => setChildRooms(prev => prev.map((item, i) => i === index ? next : item));
                                    return (
                                        <div key={`room-${index}`} className={cn('grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_32px] items-center gap-2 px-3 py-2.5', ROOM_GRID)}>
                                            <Input
                                                aria-label="Room number"
                                                value={draft.number}
                                                onChange={e => update({ ...draft, number: e.target.value })}
                                                placeholder="e.g. 101"
                                            />
                                            <Input
                                                aria-label="Room name"
                                                value={draft.name}
                                                onChange={e => update({ ...draft, name: e.target.value })}
                                                placeholder="e.g. Isolation room"
                                            />
                                            <RemoveButton
                                                label="Remove this room"
                                                onClick={() => setChildRooms(prev => prev.filter((_, i) => i !== index))}
                                            />
                                        </div>
                                    );
                                })}
                            </ListShell>
                        </Section>
                    )}

                    {kind === 'create' && level === 'room' && (
                        <Section step={stepOf('children')} title="Beds in this room" optional description="Add the beds now, or later from the room page.">
                            <ListShell
                                header={bedHeader}
                                grid={BED_GRID}
                                empty={childBeds.length ? undefined : 'No beds yet. You can also add them later.'}
                                footer={(
                                    <ListAddRow
                                        label={childBeds.length ? 'Add another bed' : 'Add a bed'}
                                        count={childBeds.length}
                                        limit={NESTED_LIMITS.bedsPerRoom}
                                        onClick={() => setChildBeds(prev => [...prev, emptyBed()])}
                                    />
                                )}
                            >
                                {childBeds.map((draft, index) => bedRow(
                                    `bed-${index}`,
                                    draft,
                                    next => setChildBeds(prev => prev.map((item, i) => i === index ? next : item)),
                                    () => setChildBeds(prev => prev.filter((_, i) => i !== index)),
                                ))}
                            </ListShell>
                        </Section>
                    )}
                </DialogBody>

                {error ? (
                    <div role="alert" className="shrink-0 border-t border-[#FEE4E2] bg-[#FEF3F2] px-5 py-2.5 text-[13px] text-[#B42318] md:px-8">
                        {error}
                    </div>
                ) : null}

                <DialogFooter className="bg-white px-5 md:px-8">
                    <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                    <Button type="button" onClick={submit} disabled={saving} className="min-w-[120px] bg-[#1E3A5F] hover:bg-[#172E4B]">
                        {saving ? 'Saving…' : submitLabel}
                    </Button>
                </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
}
