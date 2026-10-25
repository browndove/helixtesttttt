import { buildBedKpiItems, type BedKpiInput } from './kpiConfig';

export const BED_KPI_MOCK: BedKpiInput = {
    total: 26,
    available: 13,
    occupied: 10,
    blocked: 3,
    buildings: 4,
    units: 6,
    activeShare: 100,
    pendingDischarges: 2,
    cleaning: 2,
    bioMed: 1,
};

export const BED_KPI_MOCK_ITEMS = buildBedKpiItems(BED_KPI_MOCK);
