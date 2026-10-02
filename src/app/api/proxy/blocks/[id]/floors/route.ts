import { NextRequest } from 'next/server';
import { forwardToApi } from '@/lib/proxy-forward';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
    const { id } = await params;
    return forwardToApi(req, { path: `blocks/${id}/floors`, method: 'GET' });
}

// POST — create a floor on this block, optionally with nested wards
export async function POST(req: NextRequest, { params }: Params) {
    const { id } = await params;
    return forwardToApi(req, { path: `blocks/${id}/floors`, method: 'POST' });
}
