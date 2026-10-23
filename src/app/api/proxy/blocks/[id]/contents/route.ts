import { NextRequest } from 'next/server';
import { forwardToApi } from '@/lib/proxy-forward';

type Params = { params: Promise<{ id: string }> };

/** DELETE /blocks/{id}/contents — building + floors + units + rooms + beds (blocked by occupied beds). */
export async function DELETE(req: NextRequest, { params }: Params) {
    const { id } = await params;
    return forwardToApi(req, { path: `blocks/${id}/contents`, method: 'DELETE' });
}
