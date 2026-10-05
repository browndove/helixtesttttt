import { NextRequest } from 'next/server';
import { forwardToApi } from '@/lib/proxy-forward';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
    const { id } = await params;
    return forwardToApi(req, { path: `blocks/${id}`, method: 'GET' });
}

export async function PUT(req: NextRequest, { params }: Params) {
    const { id } = await params;
    return forwardToApi(req, { path: `blocks/${id}`, method: 'PUT' });
}

export async function DELETE(req: NextRequest, { params }: Params) {
    const { id } = await params;
    return forwardToApi(req, { path: `blocks/${id}`, method: 'DELETE' });
}
