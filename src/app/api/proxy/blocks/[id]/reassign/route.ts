import { NextRequest } from 'next/server';
import { forwardToApi } from '@/lib/proxy-forward';

type Params = { params: Promise<{ id: string }> };

/** POST /blocks/{id}/reassign — move this building's floors onto an existing building. */
export async function POST(req: NextRequest, { params }: Params) {
    const { id } = await params;
    return forwardToApi(req, { path: `blocks/${id}/reassign`, method: 'POST' });
}
