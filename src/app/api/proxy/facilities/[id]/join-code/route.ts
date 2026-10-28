import { NextRequest } from 'next/server';
import { forwardToApi } from '@/lib/proxy-forward';

type Params = { params: Promise<{ id: string }> };

// GET /facilities/{id}/join-code — the code staff enter to request access
export async function GET(req: NextRequest, { params }: Params) {
    const { id } = await params;
    return forwardToApi(req, { path: `facilities/${encodeURIComponent(id)}/join-code`, method: 'GET' });
}

// PUT /facilities/{id}/join-code — { uses_employee_ids }
export async function PUT(req: NextRequest, { params }: Params) {
    const { id } = await params;
    return forwardToApi(req, { path: `facilities/${encodeURIComponent(id)}/join-code`, method: 'PUT' });
}
