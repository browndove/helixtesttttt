import { NextRequest } from 'next/server';
import { forwardToApi } from '@/lib/proxy-forward';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
    const { id } = await params;
    return forwardToApi(req, { path: `rooms/${id}/beds`, method: 'GET', forwardQuery: ['status'] });
}

// POST — add beds to this room
export async function POST(req: NextRequest, { params }: Params) {
    const { id } = await params;
    return forwardToApi(req, { path: `rooms/${id}/beds`, method: 'POST' });
}
