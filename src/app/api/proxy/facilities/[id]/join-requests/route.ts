import { NextRequest } from 'next/server';
import { forwardToApi } from '@/lib/proxy-forward';

// GET /facilities/{id}/join-requests — people waiting for an admin decision
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return forwardToApi(req, { path: `facilities/${encodeURIComponent(id)}/join-requests`, method: 'GET' });
}
