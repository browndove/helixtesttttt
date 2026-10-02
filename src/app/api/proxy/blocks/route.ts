import { NextRequest } from 'next/server';
import { forwardToApi } from '@/lib/proxy-forward';

// GET /blocks — list buildings/blocks at the facility
export async function GET(req: NextRequest) {
    return forwardToApi(req, { path: 'blocks', method: 'GET', forwardQuery: ['depth'] });
}

// POST /blocks — create a block, optionally with nested floors/wards/rooms/beds
export async function POST(req: NextRequest) {
    return forwardToApi(req, { path: 'blocks', method: 'POST' });
}
