import { NextRequest } from 'next/server';
import { forwardToApi } from '@/lib/proxy-forward';

type Params = { params: Promise<{ id: string }> };

/** POST /floors/{id}/reassign — move this floor's units onto an existing floor. */
export async function POST(req: NextRequest, { params }: Params) {
    const { id } = await params;
    return forwardToApi(req, { path: `floors/${id}/reassign`, method: 'POST' });
}
