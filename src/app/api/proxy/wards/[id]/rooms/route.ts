import { NextRequest } from 'next/server';
import { forwardToApi } from '@/lib/proxy-forward';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
    const { id } = await params;
    return forwardToApi(req, { path: `wards/${id}/rooms`, method: 'GET' });
}

// POST — create a room in this ward, optionally with nested beds
export async function POST(req: NextRequest, { params }: Params) {
    const { id } = await params;
    return forwardToApi(req, { path: `wards/${id}/rooms`, method: 'POST' });
}
