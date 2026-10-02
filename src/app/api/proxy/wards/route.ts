import { NextRequest } from 'next/server';
import { forwardToApi } from '@/lib/proxy-forward';

export async function GET(req: NextRequest) {
    return forwardToApi(req, { path: 'wards', method: 'GET', forwardQuery: ['floor_id', 'block_id'] });
}

// POST /wards — create a ward (floor_id in the body), optionally with nested rooms
export async function POST(req: NextRequest) {
    return forwardToApi(req, { path: 'wards', method: 'POST' });
}
