import { NextRequest } from 'next/server';
import { forwardToApi } from '@/lib/proxy-forward';

type Params = { params: Promise<{ id: string }> };

// Rooms hang off the hierarchy unit. /wards/{id}/rooms is the old department-ward API.
export async function GET(req: NextRequest, { params }: Params) {
    const { id } = await params;
    return forwardToApi(req, { path: `units/${id}/rooms`, method: 'GET' });
}

export async function POST(req: NextRequest, { params }: Params) {
    const { id } = await params;
    return forwardToApi(req, { path: `units/${id}/rooms`, method: 'POST' });
}
