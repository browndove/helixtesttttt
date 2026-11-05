import { NextRequest } from 'next/server';
import { forwardToApi } from '@/lib/proxy-forward';

// GET /facilities/{id}/directory-reviews — open bulk-upload decisions
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return forwardToApi(req, {
        path: `facilities/${encodeURIComponent(id)}/directory-reviews`,
        method: 'GET',
    });
}
