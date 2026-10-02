import { NextRequest } from 'next/server';
import { forwardToApi } from '@/lib/proxy-forward';

export async function GET(req: NextRequest) {
    return forwardToApi(req, { path: 'rooms', method: 'GET', forwardQuery: ['ward_id'] });
}

// POST /rooms — create a room (ward_id in the body), optionally with nested beds
export async function POST(req: NextRequest) {
    return forwardToApi(req, { path: 'rooms', method: 'POST' });
}
