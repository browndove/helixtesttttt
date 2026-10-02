import { NextRequest } from 'next/server';
import { forwardToApi } from '@/lib/proxy-forward';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
    const { id } = await params;
    return forwardToApi(req, { path: `floors/${id}/wards`, method: 'GET' });
}

// POST — create a ward on this floor, optionally with nested rooms
export async function POST(req: NextRequest, { params }: Params) {
    const { id } = await params;
    return forwardToApi(req, { path: `floors/${id}/wards`, method: 'POST' });
}
