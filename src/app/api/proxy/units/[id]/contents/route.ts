import { NextRequest } from 'next/server';
import { forwardToApi } from '@/lib/proxy-forward';

type Params = { params: Promise<{ id: string }> };

/** DELETE /units/{id}/contents — delete the unit with its rooms and beds. */
export async function DELETE(req: NextRequest, { params }: Params) {
    const { id } = await params;
    return forwardToApi(req, { path: `units/${id}/contents`, method: 'DELETE' });
}
