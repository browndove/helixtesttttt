import { NextRequest } from 'next/server';
import { forwardToApi } from '@/lib/proxy-forward';

type Params = { params: Promise<{ id: string }> };

/** DELETE /floors/{id}/contents — floor + units + rooms + beds (blocked by occupied beds). */
export async function DELETE(req: NextRequest, { params }: Params) {
    const { id } = await params;
    return forwardToApi(req, { path: `floors/${id}/contents`, method: 'DELETE' });
}
