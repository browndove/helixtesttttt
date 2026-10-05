import { NextRequest } from 'next/server';
import { forwardToApi } from '@/lib/proxy-forward';

// Old department-ward API. Hierarchy wards are /units/{id}; floor listing uses /floors/{id}/wards.

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
    const { id } = await params;
    return forwardToApi(req, { path: `wards/${id}`, method: 'GET' });
}

export async function PUT(req: NextRequest, { params }: Params) {
    const { id } = await params;
    return forwardToApi(req, { path: `wards/${id}`, method: 'PUT' });
}

export async function DELETE(req: NextRequest, { params }: Params) {
    const { id } = await params;
    return forwardToApi(req, { path: `wards/${id}`, method: 'DELETE' });
}
