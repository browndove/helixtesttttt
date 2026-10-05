import { parseBlocks, type Block } from '@/lib/bed-hierarchy';

/**
 * Stand-in layout shown while the block/floor/ward/room endpoints are missing,
 * so the page can be reviewed with content in it. Nothing here is persisted.
 */

type SampleBed = [number: string, status: 'available' | 'occupied' | 'blocked', code?: string];

function beds(roomId: string, rows: SampleBed[]) {
    return rows.map(([bed_number, status, bed_code], index) => ({
        id: `${roomId}-bed-${bed_number}`,
        room_id: roomId,
        bed_number,
        status,
        ...(bed_code ? { bed_code } : {}),
        sort_order: index,
        updated_at: '2026-09-29T08:20:00Z',
    }));
}

function room(wardId: string, number: string, name: string, order: number, rows: SampleBed[]) {
    const id = `${wardId}-room-${number}`;
    return {
        id,
        ward_id: wardId,
        number,
        name,
        sort_order: order,
        updated_at: '2026-09-30T09:05:00Z',
        beds: beds(id, rows),
    };
}

const RAW = [
    {
        id: 'sample-block-main',
        name: 'Main Block',
        sort_order: 0,
        floors: [
            {
                id: 'sample-floor-main-3',
                block_id: 'sample-block-main',
                name: '3',
                sort_order: 0,
                wards: [
                    {
                        id: 'sample-ward-icu-b',
                        floor_id: 'sample-floor-main-3',
                        name: 'ICU-B',
                        code: 'ICUB',
                        type: 'icu',
                        gender_restriction: 'mixed',
                        sort_order: 0,
                        rooms: [
                            room('sample-ward-icu-b', '101', 'Quad Room', 0, [
                                ['01', 'available', 'Telemetry'],
                                ['02', 'available', 'Telemetry'],
                                ['03', 'occupied', 'Ventilator'],
                                ['04', 'available', 'Telemetry'],
                            ]),
                            room('sample-ward-icu-b', '102', 'Step-Down', 1, [
                                ['05', 'occupied', 'Standard'],
                                ['06', 'available', 'Telemetry'],
                                ['07', 'blocked', 'Standard'],
                                ['08', 'available', 'Telemetry'],
                            ]),
                        ],
                    },
                    {
                        id: 'sample-ward-pod-north',
                        floor_id: 'sample-floor-main-3',
                        name: 'Pod North',
                        code: 'PDN',
                        type: 'general',
                        gender_restriction: 'male',
                        sort_order: 1,
                        rooms: [
                            room('sample-ward-pod-north', '110', 'Bay A', 0, [
                                ['11', 'available'],
                                ['12', 'occupied'],
                                ['13', 'available'],
                            ]),
                            room('sample-ward-pod-north', '111', 'Bay B', 1, [
                                ['14', 'available'],
                                ['15', 'available'],
                            ]),
                        ],
                    },
                    {
                        id: 'sample-ward-isolation-west',
                        floor_id: 'sample-floor-main-3',
                        name: 'Isolation West',
                        code: 'ISOW',
                        type: 'isolation',
                        gender_restriction: 'mixed',
                        sort_order: 2,
                        rooms: [
                            room('sample-ward-isolation-west', '120', 'Neg-Air 1', 0, [
                                ['20', 'occupied', 'Neg-Air'],
                                ['21', 'blocked', 'Neg-Air'],
                            ]),
                        ],
                    },
                ],
            },
            {
                id: 'sample-floor-main-2',
                block_id: 'sample-block-main',
                name: '2',
                sort_order: 1,
                wards: [
                    {
                        id: 'sample-ward-recovery',
                        floor_id: 'sample-floor-main-2',
                        name: 'Recovery / PACU',
                        code: 'PACU',
                        type: 'recovery',
                        gender_restriction: 'mixed',
                        sort_order: 0,
                        rooms: [
                            room('sample-ward-recovery', '201', 'Recovery Bay', 0, [
                                ['01', 'available'],
                                ['02', 'available'],
                                ['03', 'occupied'],
                                ['04', 'available'],
                                ['05', 'available'],
                                ['06', 'blocked'],
                            ]),
                        ],
                    },
                ],
            },
        ],
    },
    {
        id: 'sample-block-maternity',
        name: 'Maternity Block',
        sort_order: 1,
        floors: [
            {
                id: 'sample-floor-maternity-2',
                block_id: 'sample-block-maternity',
                name: '2',
                sort_order: 0,
                wards: [
                    {
                        id: 'sample-ward-ldu',
                        floor_id: 'sample-floor-maternity-2',
                        name: 'Labour & Delivery Unit',
                        code: 'LDU',
                        type: 'labour',
                        gender_restriction: 'female',
                        sort_order: 0,
                        rooms: [
                            room('sample-ward-ldu', '1', 'Room 1', 0, [
                                ['01', 'occupied'],
                                ['02', 'available'],
                                ['03', 'available'],
                            ]),
                            room('sample-ward-ldu', '2', 'Room 2', 1, [
                                ['04', 'available'],
                                ['05', 'available'],
                            ]),
                            room('sample-ward-ldu', '3', 'Room 3', 2, [
                                ['06', 'occupied'],
                                ['07', 'available'],
                                ['08', 'available'],
                                ['09', 'blocked'],
                            ]),
                        ],
                    },
                    {
                        id: 'sample-ward-postnatal',
                        floor_id: 'sample-floor-maternity-2',
                        name: 'Postnatal Ward',
                        code: 'PNW',
                        type: 'maternity',
                        gender_restriction: 'female',
                        sort_order: 1,
                        rooms: [
                            room('sample-ward-postnatal', '210', 'Cubicle A', 0, [
                                ['10', 'available'],
                                ['11', 'occupied'],
                                ['12', 'available'],
                                ['13', 'available'],
                            ]),
                        ],
                    },
                ],
            },
            {
                id: 'sample-floor-maternity-1',
                block_id: 'sample-block-maternity',
                name: '1',
                sort_order: 1,
                wards: [
                    {
                        id: 'sample-ward-antenatal',
                        floor_id: 'sample-floor-maternity-1',
                        name: 'Antenatal Clinic',
                        code: 'ANC',
                        type: 'maternity',
                        gender_restriction: 'female',
                        sort_order: 0,
                        rooms: [],
                    },
                ],
            },
        ],
    },
];

export const SAMPLE_BLOCKS: Block[] = parseBlocks(RAW);
