export type BedStatus = 'available' | 'occupied' | 'blocked';

export type Bed = {
    id: string;
    department_id: string;
    ward_id?: string;
    bed_number: string;
    status: BedStatus;
    occupied_patient_id?: string | null;
    occupied_by_user_id?: string | null;
    occupied_at?: string | null;
    sort_order: number;
    created_at: string;
    updated_at: string;
    updated_by_user_id?: string;
    updated_by?: { id: string; name: string };
};

export type BedCapacity = {
    total: number;
    occupied: number;
    blocked: number;
    available: number;
    occupancy_percent: number;
    capacity_level: 'unmapped' | 'low' | 'moderate' | 'high' | 'critical';
    capacity_color: string;
    capacity_label: string;
    last_updated_at?: string;
    last_updated_by?: { id: string; name: string };
};

export type DepartmentBedSummary = BedCapacity & {
    department_id: string;
    department_name: string;
};

export type FacilityBedSummary = BedCapacity & {
    facility_id: string;
    facility_name?: string;
    departments: DepartmentBedSummary[];
};
